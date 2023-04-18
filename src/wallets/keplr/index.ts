import { Wallet } from "../../types"
import { KeplrExtensionWallet } from "./extension"
import { KeplrMobileWallet } from "./mobile"

export const wallets: Wallet[] = [KeplrExtensionWallet, KeplrMobileWallet]
