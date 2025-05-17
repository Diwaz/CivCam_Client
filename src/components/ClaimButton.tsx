import React, { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } from '@solana/spl-token';

const ClaimButton = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');

  // Replace this with your token mint address (the custom token on devnet)
  const tokenMintAddress = new PublicKey('mntW1S9ip2jGcVeGMCf3xhQdju9XXMLP1kTia2aXAFN');
  // Replace with your program's address that handles token distribution
  const distributorAddress = new PublicKey('7YKX1B9SQ9ZaLkg2Q1ndRs3gc5E8EyFVMNCK2qDs4p6m');

  const claimToken = async () => {
    if (!publicKey) {
      setStatus('Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Processing...');

      // Get the associated token account for the user
      const associatedTokenAccount = await getAssociatedTokenAddress(
        tokenMintAddress,
        publicKey
      );

      const transaction = new Transaction();

      // Check if the token account exists
      const tokenAccountInfo = await connection.getAccountInfo(associatedTokenAccount);

      // If the token account doesn't exist, create it
      if (!tokenAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey, // payer
            associatedTokenAccount, // associated token account address
            publicKey, // owner
            tokenMintAddress // mint
          )
        );
      }

      // Create a claim instruction (customized for your specific program)
      // This is a simplified example - you'll need to modify this based on your actual 
      // token distribution program's requirements
      const claimInstruction = new TransactionInstruction({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: associatedTokenAccount, isSigner: false, isWritable: true },
          { pubkey: tokenMintAddress, isSigner: false, isWritable: true },
          { pubkey: distributorAddress, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: distributorAddress,
        data: Buffer.from([1]) // Assuming 1 is the instruction code for "claim"
      });

      transaction.add(claimInstruction);

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      setStatus(`Token claimed successfully! Tx: ${signature}`);
      console.log('Transaction confirmed:', signature);
    } catch (error) {
      console.error('Error claiming token:', error);
      setStatus(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button 
        onClick={claimToken}
        disabled={isLoading || !publicKey}
        className={`px-4 py-2 rounded-lg font-medium text-white ${
          !publicKey 
            ? 'bg-gray-400' 
            : isLoading 
              ? 'bg-blue-300' 
              : 'bg-blue-600 hover:bg-blue-700'
        } transition-colors`}
      >
        {isLoading ? 'Claiming...' : 'Claim Token'}
      </button>
      {status && (
        <div className={`mt-2 text-sm ${status.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
          {status}
        </div>
      )}
    </div>
  );
};

export default ClaimButton;