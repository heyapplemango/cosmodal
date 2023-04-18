import { ChainInfo } from "@keplr-wallet/types"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

import {
  ConnectedWallet,
  ConnectWalletToChainFunction,
  IWalletManagerContext,
  UseWalletResponse,
  WalletConnectionStatus,
} from "../types"
import { getChainInfo, getConnectedWalletInfo } from "../utils"

export const WalletManagerContext = createContext<IWalletManagerContext | null>(
  null
)

export const useWalletManager = () => {
  const context = useContext(WalletManagerContext)
  if (!context) {
    throw new Error("You forgot to use WalletManagerProvider.")
  }

  return context
}

export const useWallet = (
  chainId?: ChainInfo["chainId"]
): UseWalletResponse => {
  const {
    status: managerStatus,
    error: managerError,
    connectedWallet: managerConnectedWallet,
    chainInfoOverrides,
    getSigningCosmWasmClientOptions,
    getSigningStargateClientOptions,
  } = useWalletManager()

  // Connect to chain ID if provided when main wallet connection has been
  // established.
  const shouldConnectToChainId =
    managerStatus === WalletConnectionStatus.Connected &&
    !!managerConnectedWallet &&
    !!chainId
  const [chainIdStatus, setChainIdStatus] = useState<WalletConnectionStatus>(
    WalletConnectionStatus.Initializing
  )

  const [chainIdError, setChainIdError] = useState<unknown>()
  const [chainIdConnectedWallet, setChainIdConnectedWallet] =
    useState<ConnectedWallet>()
  useEffect(() => {
    // If should not connect, already connecting, or already connected, do
    // nothing.
    if (
      !shouldConnectToChainId ||
      chainIdStatus === WalletConnectionStatus.Connecting ||
      chainIdStatus === WalletConnectionStatus.Connected
    ) {
      return
    }

    // Try to connect.
    const connect = async () => {
      setChainIdStatus(WalletConnectionStatus.Connecting)
      setChainIdConnectedWallet(undefined)
      setChainIdError(undefined)

      try {
        const chainInfo = await getChainInfo(chainId, chainInfoOverrides)

        setChainIdConnectedWallet(
          await getConnectedWalletInfo(
            managerConnectedWallet.wallet,
            managerConnectedWallet.walletClient,
            chainInfo,
            await getSigningCosmWasmClientOptions?.(chainInfo),
            await getSigningStargateClientOptions?.(chainInfo)
          )
        )
        setChainIdStatus(WalletConnectionStatus.Connected)
      } catch (error) {
        console.error(error)
        setChainIdError(error)
      }
    }

    connect()
  }, [
    managerStatus,
    managerConnectedWallet,
    chainId,
    getSigningCosmWasmClientOptions,
    getSigningStargateClientOptions,
    chainInfoOverrides,
    shouldConnectToChainId,
    chainIdStatus,
  ])

  // If chainId wallet is connected and manager wallet changes status away from
  // connected, reset so that we reconnect once manager reconnects. This ensures
  // that we disconnect when the manager disconnects, and update accounts when
  // the manager changes accounts.
  useEffect(() => {
    if (
      !!chainId &&
      !!chainIdConnectedWallet &&
      chainIdStatus === WalletConnectionStatus.Connected &&
      managerStatus !== WalletConnectionStatus.Connected
    ) {
      setChainIdStatus(WalletConnectionStatus.Initializing)
      setChainIdError(undefined)
      setChainIdConnectedWallet(undefined)
    }
  }, [managerStatus, chainId, chainIdStatus, chainIdConnectedWallet])

  const status = shouldConnectToChainId ? chainIdStatus : managerStatus
  const connected = status === WalletConnectionStatus.Connected
  const error = shouldConnectToChainId ? chainIdError : managerError
  const connectedWallet = chainId
    ? chainIdConnectedWallet
    : managerConnectedWallet

  return { status, connected, error, ...connectedWallet }
}

export const useConnectWalletToChain = () => {
  const {
    status,
    connectedWallet,
    chainInfoOverrides,
    getSigningCosmWasmClientOptions,
    getSigningStargateClientOptions,
  } = useWalletManager()

  const connectWalletToChain: ConnectWalletToChainFunction = useCallback(
    async (chainId) => {
      if (status !== WalletConnectionStatus.Connected || !connectedWallet) {
        throw new Error("Wallet must first be connected to the default chain.")
      }

      const chainInfo = await getChainInfo(chainId, chainInfoOverrides)

      return await getConnectedWalletInfo(
        connectedWallet.wallet,
        connectedWallet.walletClient,
        chainInfo,
        await getSigningCosmWasmClientOptions?.(chainInfo),
        await getSigningStargateClientOptions?.(chainInfo)
      )
    },
    [
      chainInfoOverrides,
      connectedWallet,
      getSigningCosmWasmClientOptions,
      getSigningStargateClientOptions,
      status,
    ]
  )

  return connectWalletToChain
}
