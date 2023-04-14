import { Wallet, WalletType } from "../../types"
import { Web3AuthClient } from "./client"

export const Web3AuthWallet: Wallet = {
  type: WalletType.Web3Auth,
  name: "Web3Auth",
  description: "web3auth.io",
  imageUrl: "https://web3auth.io/images/w3a-L-Favicon-1.svg",
  getClient: async (chainInfo, _, options) =>
    Web3AuthClient.setup(chainInfo, options),
  getOfflineSignerFunction: (client) =>
    // This function expects to be bound to the `client` instance.
    client.getOfflineSignerAuto.bind(client),
}
