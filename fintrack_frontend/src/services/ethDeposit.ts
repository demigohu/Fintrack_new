import { ethers } from 'ethers';

// Type declarations untuk MetaMask
declare global {
  interface Window {
    ethereum?: any;
  }
}

// ABI dari helper smart contract
const contractABI = [
  {
    inputs: [{ internalType: 'address', name: '_cketh_minter_main_address', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'from', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' },
      { indexed: true, internalType: 'bytes32', name: 'principal', type: 'bytes32' },
    ],
    name: 'ReceivedEth',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'SentEth',
    type: 'event',
  },
  {
    inputs: [{ internalType: 'bytes32', name: '_principal', type: 'bytes32' }],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getMinterAddress',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// Fungsi untuk mengkonversi principal ke bytes32 menggunakan backend
async function principalToBytes32(principal: string): Promise<string> {
  try {
    // Import backend service secara dinamis
    const { getBackendActor } = await import('../lib/ic');
    const actor = await getBackendActor();
    
    // Call backend function
    const result = await actor.principal_to_bytes32(principal);
    
    if ('Ok' in result) {
      return result.Ok; // Success case
    } else {
      throw new Error(result.Err || 'Failed to convert principal');
    }
  } catch (error) {
    console.error('Error converting principal to bytes32:', error);
    // Fallback to hash method if backend fails
    const { ethers } = await import('ethers');
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(principal));
    return hash;
  }
}

// Fungsi untuk menghubungkan MetaMask
async function connectMetaMask(): Promise<ethers.providers.Web3Provider | null> {
  if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
    try {
      // Request akun dari MetaMask
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      return provider;
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      return null;
    }
  } else {
    console.error('MetaMask is not installed');
    return null;
  }
}

// Fungsi untuk mendapatkan address helper contract dari backend
export async function getHelperContractAddress(): Promise<string | null> {
  try {
    // Import service secara dinamis untuk menghindari SSR issues
    const { ethereumService } = await import('./backend');
    const result = await ethereumService.getEthDepositAddress();
    
    if (result.success) {
      return result.data;
    } else {
      console.error('Failed to get helper contract address:', result.error);
      return null;
    }
  } catch (error) {
    console.error('Error getting helper contract address:', error);
    return null;
  }
}

// Fungsi untuk melakukan deposit ETH ke helper contract
export async function depositEthToContract(
  contractAddress: string,
  principal: string,
  amountInEth: string
): Promise<{ success: boolean; data?: { hash: string; receipt: any; principalBytes32: string }; error?: string }> {
  try {
    // Hubungkan ke MetaMask
    const provider = await connectMetaMask();
    if (!provider) {
      throw new Error('Failed to connect to MetaMask');
    }

    // Dapatkan signer dari provider
    const signer = await provider.getSigner();

    // Inisialisasi contract
    const contract = new ethers.Contract(contractAddress, contractABI, signer);

    // Konversi principal ke bytes32
    const principalBytes32 = await principalToBytes32(principal);

    // Konversi amount dari ETH ke Wei
    const amountInWei = ethers.utils.parseEther(amountInEth);

    // Kirim transaksi deposit
    const tx = await contract.deposit(principalBytes32, {
      value: amountInWei,
      gasLimit: 100000, // Atur gas limit sesuai kebutuhan
    });

    // Tunggu konfirmasi transaksi
    const receipt = await tx.wait();
    
    console.log('Deposit successful!');
    console.log('Transaction hash:', receipt.hash);
    console.log('Principal bytes32:', principalBytes32);
    
    return {
      success: true,
      data: {
        hash: receipt.hash,
        receipt: receipt,
        principalBytes32: principalBytes32
      }
    };
  } catch (error: any) {
    console.error('Error during deposit:', error);
    return {
      success: false,
      error: error.message || 'Failed to deposit ETH'
    };
  }
}
