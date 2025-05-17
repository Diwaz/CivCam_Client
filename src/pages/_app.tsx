// pages/_app.tsx
// import '../styles/globals.css'
import '@solana/wallet-adapter-react-ui/styles.css' // Required for wallet UI

import type { AppProps } from 'next/app'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
    PhantomWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import { useMemo } from 'react'

export default function App({ Component, pageProps }: AppProps) {
    const endpoint = clusterApiUrl('devnet')

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
        ],
        []
    )

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    <Component {...pageProps} />
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    )
}
