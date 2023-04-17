import { OfflineAminoSigner } from "@cosmjs/amino"
import { fromBech32 } from "@cosmjs/encoding"
import { OfflineDirectSigner } from "@cosmjs/proto-signing"
import { ChainInfo } from "@keplr-wallet/types"
import eccrypto from "@toruslabs/eccrypto"
import { LOGIN_PROVIDER_TYPE, OPENLOGIN_NETWORK } from "@toruslabs/openlogin"
import { UserInfo } from "@web3auth/base"

import { WalletClient } from "../../types"
import { Web3AuthSigner } from "./signers"
import { Web3AuthClientOptions } from "./types"
import { connectClientAndProvider, decrypt, sendAndListenOnce } from "./utils"

// In case these get overwritten by an attacker.
const terminate =
  typeof Worker !== "undefined" ? Worker.prototype.terminate : undefined

export class Web3AuthClient implements WalletClient {
  loginProvider: LOGIN_PROVIDER_TYPE

  #worker: Worker
  #clientPrivateKey: Buffer
  #workerPublicKey: Buffer
  #userInfo: Partial<UserInfo>
  #options: Web3AuthClientOptions

  // Map chain ID to chain info.
  chainInfo: Record<string, ChainInfo | undefined> = {}
  // Map chain ID to signer.
  #signers: Record<string, Web3AuthSigner | undefined> = {}

  constructor(
    loginProvider: LOGIN_PROVIDER_TYPE,
    worker: Worker,
    clientPrivateKey: Buffer,
    workerPublicKey: Buffer,
    userInfo: Partial<UserInfo>,
    options: Web3AuthClientOptions
  ) {
    this.loginProvider = loginProvider
    this.#worker = worker
    this.#clientPrivateKey = clientPrivateKey
    this.#workerPublicKey = workerPublicKey
    this.#userInfo = userInfo
    this.#options = Object.freeze(options)
  }

  static async setup(
    loginProvider: LOGIN_PROVIDER_TYPE,
    _options?: Partial<Web3AuthClientOptions>
  ): Promise<Web3AuthClient> {
    // Validate options since they're not type-checked on input.
    if (typeof _options?.client?.clientId !== "string") {
      throw new Error("Invalid web3auth client ID")
    }
    if (
      typeof _options?.client?.web3AuthNetwork !== "string" ||
      !Object.values(OPENLOGIN_NETWORK).includes(
        _options.client.web3AuthNetwork
      )
    ) {
      throw new Error("Invalid web3auth network")
    }
    if (typeof _options.promptSign !== "function") {
      throw new Error("Invalid promptSign function")
    }

    const options = _options as Web3AuthClientOptions

    // Don't keep any reference to these around after this function since they
    // internally store a reference to the private key. Once we have the private
    // key, send it to the worker and forget about it. After this function, the
    // only reference to the private key is in the worker, and this client and
    // provider will be destroyed by the garbage collector, hopefully ASAP.
    const { client, provider } = await connectClientAndProvider(
      loginProvider,
      options
    )

    // Get connected user info.
    const userInfo = await client.getUserInfo()

    // Get the private key.
    const privateKeyHex = await provider?.request({
      method: "private_key",
    })
    if (typeof privateKeyHex !== "string") {
      throw new Error(`Failed to connect to ${loginProvider}`)
    }

    // Generate a private key for this client to interact with the worker.
    const clientPrivateKey = eccrypto.generatePrivate()
    const clientPublicKey = eccrypto.getPublic(clientPrivateKey).toString("hex")

    // Spawn a new worker that will handle the private key and signing.
    const worker = new Worker(new URL("./worker.js", import.meta.url))

    // Begin two-step handshake to authenticate with the worker and exchange
    // communication public keys as well as the wallet private key.

    // 1. Send client public key so the worker can verify our signatures, and
    //    get the worker public key for encrypting the wallet private key in the
    //    next init step.
    let workerPublicKey: Buffer | undefined
    await sendAndListenOnce(
      worker,
      {
        type: "init_1",
        payload: {
          publicKey: clientPublicKey,
        },
      },
      async (data) => {
        if (data.type === "ready_1") {
          workerPublicKey = await decrypt(
            clientPrivateKey,
            data.payload.encryptedPublicKey
          )
          return true
        } else if (data.type === "init_error") {
          throw new Error(data.payload.error)
        }

        return false
      }
    )
    if (!workerPublicKey) {
      throw new Error("Failed to authenticate with worker")
    }

    // 2. Encrypt and send the wallet private key to the worker. This is the
    //    last usage of `workerPublicKey`, so ideally it gets garbage collected
    //    ASAP.
    const encryptedPrivateKey = await eccrypto.encrypt(
      workerPublicKey,
      Buffer.from(privateKeyHex, "hex")
    )
    await sendAndListenOnce(
      worker,
      {
        type: "init_2",
        payload: {
          encryptedPrivateKey,
        },
      },
      (data) => {
        if (data.type === "ready_2") {
          return true
        } else if (data.type === "init_error") {
          throw new Error(data.payload.error)
        }

        return false
      }
    )

    // Store this client's private key for future message sending signatures.
    return new Web3AuthClient(
      loginProvider,
      worker,
      clientPrivateKey,
      workerPublicKey,
      userInfo,
      options
    )
  }

  async experimentalSuggestChain(chainInfo: ChainInfo): Promise<void> {
    this.chainInfo[chainInfo.chainId] = chainInfo
  }

  async enable(_chainIds: string | string[]) {
    const chainIds = [_chainIds].flat()
    if (chainIds.some((chainId) => !this.chainInfo[chainId])) {
      throw new Error("Chain not supported")
    }

    // Create signers.
    await Promise.all(
      chainIds.map(async (chainId) => {
        const chainInfo = this.chainInfo[chainId]
        if (!chainInfo) {
          throw new Error("Chain not supported")
        }
        this.#signers[chainId] = new Web3AuthSigner(
          chainInfo,
          this.#worker,
          this.#clientPrivateKey,
          this.#workerPublicKey,
          this.#options.promptSign
        )
      })
    )
  }

  async disconnect() {
    // Attempt to logout by first connecting a new client and then logging out
    // if connected. It does not attempt to log in if it cannot automatically
    // login from the cached session. This removes the need to keep the client
    // around, which internally keeps a reference to the private key.
    try {
      const { client } = await connectClientAndProvider(
        this.loginProvider,
        this.#options,
        { dontAttemptLogin: true }
      )

      await client.logout({
        cleanup: true,
      })
    } catch (err) {
      console.warn("Web3Auth failed to logout:", err)
    }
    terminate?.call(this.#worker)
    this.#signers = {}
  }

  getOfflineSigner(chainId: string) {
    const signer = this.#signers[chainId]
    if (!signer) {
      throw new Error("Signer not enabled")
    }
    return signer
  }

  async getOfflineSignerAuto(
    chainId: string
  ): Promise<OfflineAminoSigner | OfflineDirectSigner> {
    return this.getOfflineSigner(chainId)
  }

  getOfflineSignerOnlyAmino(chainId: string): OfflineAminoSigner {
    return this.getOfflineSigner(chainId)
  }

  async getKey(chainId: string): Promise<{
    name: string
    algo: string
    pubKey: Uint8Array
    address: Uint8Array
    bech32Address: string
  }> {
    const { address, algo, pubkey } = (
      await this.getOfflineSigner(chainId).getAccounts()
    )[0]

    return {
      name: this.#userInfo.name || this.#userInfo.email || address,
      algo,
      pubKey: pubkey,
      address: fromBech32(address).data,
      bech32Address: address,
    }
  }
}
