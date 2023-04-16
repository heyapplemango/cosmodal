import { Secp256k1Wallet } from "@cosmjs/amino"
import { DirectSecp256k1Wallet } from "@cosmjs/proto-signing"
import eccrypto from "@toruslabs/eccrypto"

import { ToWorkerMessage } from "./types"
import { decrypt, hashObject } from "./utils"

let clientPublicKey: Buffer | undefined
let workerPrivateKey: Buffer | undefined
let walletPrivateKey: Uint8Array | undefined

self.onmessage = async ({ data }: MessageEvent<ToWorkerMessage>) => {
  if (data.type === "init_1") {
    clientPublicKey = Buffer.from(data.payload.publicKey, "hex")

    workerPrivateKey = eccrypto.generatePrivate()

    const encryptedPublicKey = await eccrypto.encrypt(
      clientPublicKey,
      eccrypto.getPublic(workerPrivateKey)
    )

    return self.postMessage({
      type: "ready_1",
      payload: {
        encryptedPublicKey,
      },
    })
  }

  if (!clientPublicKey || !workerPrivateKey) {
    throw new Error("Web3Auth worker not initialized")
  }

  if (data.type === "init_2") {
    // Decrypt the private key.
    walletPrivateKey = await decrypt(
      workerPrivateKey,
      data.payload.encryptedPrivateKey
    )

    return self.postMessage({
      type: "ready_2",
    })
  }

  if (!walletPrivateKey) {
    throw new Error("Web3Auth client not initialized")
  }

  if (data.type === "request_accounts") {
    try {
      const accounts = await (
        await DirectSecp256k1Wallet.fromKey(
          walletPrivateKey,
          data.payload.chainBech32Prefix
        )
      ).getAccounts()

      return self.postMessage({
        type: "accounts",
        payload: {
          response: {
            type: "success",
            accounts,
          },
        },
      })
    } catch (err) {
      console.error("Web3Auth worker accounts error", err)
      return self.postMessage({
        type: "accounts",
        payload: {
          response: {
            type: "error",
            error: err instanceof Error ? err.message : `${err}`,
          },
        },
      })
    }
  }

  if (data.type === "request_sign") {
    try {
      // Verify signature.
      await eccrypto.verify(
        clientPublicKey,
        hashObject(data.payload),
        Buffer.from(data.signature)
      )

      if (data.payload.data.type === "direct") {
        const response = await (
          await DirectSecp256k1Wallet.fromKey(
            walletPrivateKey,
            data.payload.chainBech32Prefix
          )
        ).signDirect(data.payload.signerAddress, data.payload.data.value)
        self.postMessage({
          type: "sign",
          payload: {
            id: data.payload.id,
            response: {
              type: "direct",
              value: response,
            },
          },
        })
      } else if (data.payload.data.type === "amino") {
        const response = await (
          await Secp256k1Wallet.fromKey(
            walletPrivateKey,
            data.payload.chainBech32Prefix
          )
        ).signAmino(data.payload.signerAddress, data.payload.data.value)
        self.postMessage({
          type: "sign",
          payload: {
            id: data.payload.id,
            response: {
              type: "amino",
              value: response,
            },
          },
        })
      } else {
        throw new Error("Invalid sign data type")
      }
    } catch (err) {
      console.error("Web3Auth worker sign error", err)
      self.postMessage({
        type: "sign",
        payload: {
          id: data.payload.id,
          response: {
            type: "error",
            value: err instanceof Error ? err.message : `${err}`,
          },
        },
      })
    }
  }
}
