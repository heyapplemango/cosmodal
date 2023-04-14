import { Wallet, WalletType } from "../../types"
import { Web3AuthClient } from "./client"

export const Web3AuthWallet: Wallet = {
  type: WalletType.Web3Auth,
  name: "Google account or other social login",
  description: "Self-custody via Web3Auth",
  imageUrl: "https://web3auth.io/images/w3a-L-Favicon-1.svg",
  getClient: async (_chainInfo, _walletConnect, options) =>
    await Web3AuthClient.setup(options),
  getOfflineSignerFunction: (client) =>
    // This function expects to be bound to the `client` instance.
    client.getOfflineSignerAuto.bind(client),
}
