import { Wallet, WalletType } from "../../../types"

export const KeplrMobileWallet: Wallet = {
  type: WalletType.WalletConnectKeplr,
  name: "WalletConnect",
  description: "Keplr Mobile",
  imageUrl:
    "https://bafkreibkroyj2jbsyhiybw44hcsljfftjwa2iyk32ncauk5sygz2lc5hyi.ipfs.nftstorage.link",
  getClient: async (chainInfo, walletConnect) => {
    if (walletConnect?.connected) {
      return new (await import("./KeplrWalletConnectV1")).KeplrWalletConnectV1(
        walletConnect,
        [chainInfo]
      )
    }
    throw new Error("Mobile wallet not connected.")
  },
  // WalletConnect only supports Amino signing.
  getOfflineSignerFunction: (client) =>
    // This function expects to be bound to the `client` instance.
    client.getOfflineSignerOnlyAmino.bind(client),
  windowKeystoreRefreshEvent: "keplr_keystorechange",
}
