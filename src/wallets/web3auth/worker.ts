import { Secp256k1Wallet } from "@cosmjs/amino"
import { DirectSecp256k1Wallet } from "@cosmjs/proto-signing"

import { ToWorkerMessage } from "./types"

let privateKey: Uint8Array | undefined

self.onmessage = async ({ data }: MessageEvent<ToWorkerMessage>) => {
  if (data.type === "init") {
    privateKey = data.payload.privateKey
    return self.postMessage({
      type: "ready",
    })
  }

  if (!privateKey) {
    throw new Error("Web3Auth client not initialized")
  }

  if (data.type === "request_accounts") {
    try {
      const accounts = await (
        await DirectSecp256k1Wallet.fromKey(
          privateKey,
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
      if (data.payload.data.type === "direct") {
        const response = await (
          await DirectSecp256k1Wallet.fromKey(
            privateKey,
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
            privateKey,
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
