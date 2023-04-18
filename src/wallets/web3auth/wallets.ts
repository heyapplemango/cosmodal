import { LOGIN_PROVIDER } from "@toruslabs/openlogin"

import { Wallet, WalletType } from "../../types"
import { Web3AuthClient } from "./client"

const Web3AuthBaseWallet: Pick<
  Wallet,
  "description" | "getOfflineSignerFunction"
> = {
  description: "Self-custody via Web3Auth",
  getOfflineSignerFunction: (client) =>
    // This function expects to be bound to the `client` instance.
    client.getOfflineSignerAuto.bind(client),
}

export const Web3AuthGoogleWallet: Wallet = {
  type: WalletType.Google,
  name: "Google",
  imageUrl:
    "https://bafkreihcbb7vqxb3ee52kn5fnsf4rzqtjru5n6q2k4ungbw7k3ljpnhhvm.ipfs.nftstorage.link/",
  getClient: async (_chainInfo, _walletConnect, options) =>
    await Web3AuthClient.setup(LOGIN_PROVIDER.GOOGLE, options),

  ...Web3AuthBaseWallet,
}

export const Web3AuthAppleWallet: Wallet = {
  type: WalletType.Apple,
  name: "Apple",
  imageUrl:
    "https://bafkreih5fbwcnzq4xmarrgcf5wkr5mpx5gfia2loj5fruaa542v7kwv5iq.ipfs.nftstorage.link/",
  getClient: async (_chainInfo, _walletConnect, options) =>
    await Web3AuthClient.setup(LOGIN_PROVIDER.APPLE, options),

  ...Web3AuthBaseWallet,
}

export const Web3AuthDiscordWallet: Wallet = {
  type: WalletType.Discord,
  name: "Discord",
  imageUrl:
    "https://bafkreifssoo7ljepiix4tvrpe4gbqlyhwx6vu6rtir4ou45pj7nv5mjnhm.ipfs.nftstorage.link/",
  getClient: async (_chainInfo, _walletConnect, options) =>
    await Web3AuthClient.setup(LOGIN_PROVIDER.DISCORD, options),

  ...Web3AuthBaseWallet,
}

export const Web3AuthTwitterWallet: Wallet = {
  type: WalletType.Twitter,
  name: "Twitter",
  imageUrl:
    "https://bafkreibfs3mpmwmaxqakpkpss7pjoe4tl2td3ghxt2mi75pyvrm47qn4jy.ipfs.nftstorage.link/",
  getClient: async (_chainInfo, _walletConnect, options) =>
    await Web3AuthClient.setup(LOGIN_PROVIDER.TWITTER, options),

  ...Web3AuthBaseWallet,
}

export const wallets: Wallet[] = [
  Web3AuthGoogleWallet,
  Web3AuthAppleWallet,
  Web3AuthDiscordWallet,
  Web3AuthTwitterWallet,
]
