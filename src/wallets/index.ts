import { Wallet } from "../types"
import { wallets as keplrWallets } from "./keplr"
import { wallets as leapWallets } from "./leap"

export const WALLETS: Wallet[] = [...keplrWallets, ...leapWallets]
