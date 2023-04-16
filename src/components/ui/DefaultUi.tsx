import React from "react"

import { UiProps, WalletConnectionStatus } from "../../types"
import { BaseModal } from "./BaseModal"
import { ConnectingWalletModal } from "./ConnectingWalletModal"
import { SelectWalletModal } from "./SelectWalletModal"
import { WalletConnectModal } from "./WalletConnectModal"

export const DefaultUi = ({
  status,
  wallets,
  connectToWallet,
  reset,
  walletConnectUri,
  cancel,
  defaultUiConfig: {
    showConnectingModalOnAutoconnect = false,
    classNames,
    closeIcon,
    renderLoader,
  } = {},
}: UiProps) =>
  status === WalletConnectionStatus.SelectingWallet ? (
    <SelectWalletModal
      classNames={classNames}
      closeIcon={closeIcon}
      isOpen
      onClose={cancel}
      selectWallet={connectToWallet}
      wallets={wallets}
    />
  ) : status === WalletConnectionStatus.Connecting ||
    // Don't show enabling modal on autoconnect attempt (first try when load
    // page likely), unless overridden from prop.
    (status === WalletConnectionStatus.AttemptingAutoConnection &&
      showConnectingModalOnAutoconnect) ? (
    walletConnectUri ? (
      <WalletConnectModal
        classNames={classNames}
        closeIcon={closeIcon}
        isOpen
        onClose={cancel}
        reset={reset}
        uri={walletConnectUri}
      />
    ) : (
      <ConnectingWalletModal
        classNames={classNames}
        closeIcon={closeIcon}
        isOpen
        renderLoader={renderLoader}
        reset={reset}
      />
    )
  ) : status === WalletConnectionStatus.Resetting ? (
    <BaseModal
      classNames={classNames}
      isOpen
      maxWidth="24rem"
      title="Resetting..."
    >
      {renderLoader?.()}
    </BaseModal>
  ) : null
