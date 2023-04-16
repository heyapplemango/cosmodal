import React, { FunctionComponent } from "react"
import styled from "styled-components"

import { Wallet } from "../../types"
import { wallets as WEB3AUTH_WALLETS } from "../../wallets/web3auth"
import { BaseModal, BaseModalProps, ModalSubheader } from "./BaseModal"

export interface SelectWalletModalProps extends BaseModalProps {
  wallets: Wallet[]
  selectWallet: (wallet: Wallet) => void
}

export const SelectWalletModal: FunctionComponent<SelectWalletModalProps> = ({
  wallets,
  selectWallet,
  classNames,
  ...props
}) => {
  const web3AuthWallets = wallets.filter((wallet) =>
    WEB3AUTH_WALLETS.includes(wallet)
  )
  const otherWallets = wallets.filter(
    (wallet) => !WEB3AUTH_WALLETS.includes(wallet)
  )

  return (
    <BaseModal
      classNames={classNames}
      title={
        web3AuthWallets.length > 0
          ? "Select a sign-in method"
          : "Select a wallet"
      }
      {...props}
    >
      <WalletList className={classNames?.walletList}>
        {web3AuthWallets.length > 0 && (
          <Web3AuthWallets>
            {web3AuthWallets.map((wallet) => (
              <Web3AuthWalletContainer
                key={wallet.type}
                className={classNames?.wallet}
                onClick={(e) => {
                  e.preventDefault()
                  selectWallet(wallet)
                }}
              >
                <Web3AuthWalletIconImg
                  alt="logo"
                  className={classNames?.walletImage}
                  src={wallet.imageUrl}
                />
              </Web3AuthWalletContainer>
            ))}
          </Web3AuthWallets>
        )}

        {web3AuthWallets.length > 0 && otherWallets.length > 0 && (
          <Web3AuthWalletSeparatorHeader className={classNames?.modalSubheader}>
            or select a wallet...
          </Web3AuthWalletSeparatorHeader>
        )}

        {otherWallets.map((wallet) => (
          <WalletRow
            key={wallet.type}
            className={classNames?.wallet}
            onClick={(e) => {
              e.preventDefault()
              selectWallet(wallet)
            }}
          >
            <WalletIconImg
              alt="logo"
              className={classNames?.walletImage}
              src={wallet.imageUrl}
            />
            <WalletInfo className={classNames?.walletInfo}>
              <WalletName className={classNames?.walletName}>
                {wallet.name}
              </WalletName>
              <WalletDescription className={classNames?.walletDescription}>
                {wallet.description}
              </WalletDescription>
            </WalletInfo>
          </WalletRow>
        ))}
      </WalletList>
    </BaseModal>
  )
}

const WalletList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const Web3AuthWallets = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  gap: 1rem;
  margin: 1rem 0;
`

const Web3AuthWalletContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  flex: 1;

  cursor: pointer;
  transition: opacity 0.2s ease;
  opacity: 1;
  &:hover {
    opacity: 0.8;
  }
  &:active {
    opacity: 0.7;
  }
`

const Web3AuthWalletSeparatorHeader = styled(ModalSubheader)``

const WalletRow = styled.div`
  border-radius: 1rem;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  background-color: rgb(229 231 235);
  box-shadow: inset 0 0 0 1px rgb(156 163 175);
  cursor: pointer;

  transition: opacity 0.2s ease;
  opacity: 1;
  &:hover {
    opacity: 0.8;
  }
  &:active {
    opacity: 0.7;
  }
`

const WalletIconImg = styled.img`
  width: 4rem;
  height: 4rem;
  object-fit: contain;
  object-position: center;
`

const Web3AuthWalletIconImg = styled.img`
  max-width: 3rem;
  max-height: 3rem;
  object-fit: contain;
  object-position: center;
`

const WalletInfo = styled.div`
  display: flex;
  flex-direction: column;
  margin-left: 1.25rem;
`

const WalletName = styled.div`
  color: black;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.75rem;
`

const WalletDescription = styled.div`
  margin-top: 0.25rem;
  color: rgb(75 85 99);
`
