// lib/auth-utils.ts
interface MerchantInfo {
  id: string;
  businessName?: string;
  businessEmail: string;
  walletAddress: string;
  defaultCurrency?: string;
  businessLogo?: string;
  createdAt?: string;
  webhookUrl?: string;
  phone?: string;
}

interface ApiKeys {
  publicKey: string;
  secretKey?: string; // Optional, only returned once during generation
}

export class AuthManager {
  private static isBrowser(): boolean {
    return typeof window !== "undefined" && typeof localStorage !== "undefined";
  }

  static getMerchantInfo(): MerchantInfo | null {
    if (!this.isBrowser()) return null;
    const merchant = localStorage.getItem("merchant");
    return merchant ? JSON.parse(merchant) : null;
  }

  static setMerchantInfo(merchant: MerchantInfo): void {
    if (!this.isBrowser()) return;
    localStorage.setItem("merchant", JSON.stringify(merchant));
  }

  static getApiKeys(environment: "testnet" | "mainnet"): ApiKeys | null {
    if (!this.isBrowser()) return null;
    const keys = localStorage.getItem(`${environment}_keys`);
    return keys ? JSON.parse(keys) : null;
  }

  static setApiKeys(environment: "testnet" | "mainnet", keys: ApiKeys): void {
    if (!this.isBrowser()) return;
    localStorage.setItem(`${environment}_keys`, JSON.stringify(keys));
  }

  static getCurrentEnvironment(): "testnet" | "mainnet" {
    if (!this.isBrowser()) return "testnet";
    return (
      (localStorage.getItem("current_environment") as "testnet" | "mainnet") ||
      "testnet"
    );
  }

  static setCurrentEnvironment(environment: "testnet" | "mainnet"): void {
    if (!this.isBrowser()) return;
    localStorage.setItem("current_environment", environment);
  }

  static async isAuthenticated(): Promise<boolean> {
    const merchant = this.getMerchantInfo();
    const currentEnv = this.getCurrentEnvironment();
    const keys = this.getApiKeys(currentEnv);

    if (!merchant || !keys?.publicKey) {
      console.error(
        "Authentication failed: Missing merchant info or public key"
      );
      return false;
    }

    try {
      const response = await fetch("/api/auth/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: keys.publicKey,
          walletAddress: merchant.walletAddress,
        }),
      });

      if (response.status === 401) {
        console.warn(
          "Public key verification returned 401 - key may be invalid"
        );
        return false;
      }

      const { success, error } = await response.json();
      if (!success) {
        console.error("Authentication failed:", error);
        return false;
      }
      return true;
    } catch (error) {
      console.error(
        "Authentication error:",
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }

  static clearAuth(): void {
    if (!this.isBrowser()) return;
    localStorage.removeItem("merchant");
    localStorage.removeItem("testnet_keys");
    localStorage.removeItem("mainnet_keys");
    localStorage.removeItem("current_environment");
  }

  static async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {},
    environment?: "testnet" | "mainnet"
  ): Promise<Response> {
    const currentEnv = environment || this.getCurrentEnvironment();
    const keys = this.getApiKeys(currentEnv);
    const merchant = this.getMerchantInfo();

    console.log("Making authenticated request with keys:", keys);    

    if (!keys?.publicKey || !merchant?.walletAddress) {
      throw new Error("No public key or wallet address found");
    }

    const headers = {
      ...options.headers,
      "x-api-key": keys.publicKey,
      // "X-Wallet-Address": merchant.walletAddress,
      "X-Environment": currentEnv,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      console.warn("Request returned 401 - API key may be invalid");
    }

    return response;
  }
}
