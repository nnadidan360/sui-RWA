// PHASE 2: Asset Tokenization and Fractionalization
// Task 16.3 - Tax Reporting Service
// Generates tax reports for dividend income

import DividendClaim from '../../models/DividendClaim';
import DividendPreference from '../../models/DividendPreference';
import logger from '../../utils/logger';

interface TaxReport {
  holder: string;
  taxYear: number;
  country: string;
  currency: string;
  
  // Summary
  totalDividends: string;
  totalDividendsFiat: string;
  distributionCount: number;
  
  // By token
  tokenBreakdown: TokenDividendSummary[];
  
  // Monthly breakdown
  monthlyBreakdown: MonthlyDividendSummary[];
  
  // Tax forms
  form1099Div?: Form1099Div; // US
  form1042S?: Form1042S; // US non-resident
  
  generatedAt: Date;
}

interface TokenDividendSummary {
  tokenId: string;
  assetName: string;
  assetType: string;
  totalDividends: string;
  totalDividendsFiat: string;
  claimCount: number;
  averageTokenBalance: string;
}

interface MonthlyDividendSummary {
  month: number;
  year: number;
  totalDividends: string;
  totalDividendsFiat: string;
  claimCount: number;
}

interface Form1099Div {
  payerName: string;
  payerTIN: string;
  recipientName: string;
  recipientTIN: string;
  ordinaryDividends: string; // Box 1a
  qualifiedDividends: string; // Box 1b
  totalCapitalGain: string; // Box 2a
  foreignTaxPaid: string; // Box 7
}

interface Form1042S {
  withholdingAgent: string;
  recipient: string;
  incomeCode: string;
  grossIncome: string;
  taxRate: number;
  taxWithheld: string;
}

export class TaxReportingService {
  /**
   * Generate comprehensive tax report for holder
   */
  async generateTaxReport(
    holder: string,
    taxYear: number
  ): Promise<TaxReport> {
    try {
      logger.info('Generating tax report', { holder, taxYear });

      // Get holder preferences
      const preference = await DividendPreference.findOne({ holder });
      const country = preference?.taxCountry || 'US';
      const currency = preference?.reportingCurrency || 'USD';

      // Get all claims for the year
      const claims = await DividendClaim.find({
        holder,
        taxYear,
        isClaimed: true,
      });

      // Calculate totals
      const totalDividends = this.sumDividends(claims);
      const totalDividendsFiat = this.sumFiatValue(claims);

      // Generate token breakdown
      const tokenBreakdown = await this.generateTokenBreakdown(claims);

      // Generate monthly breakdown
      const monthlyBreakdown = this.generateMonthlyBreakdown(claims);

      // Generate tax forms
      let form1099Div, form1042S;
      if (country === 'US') {
        form1099Div = await this.generate1099Div(holder, taxYear, claims);
      }

      const report: TaxReport = {
        holder,
        taxYear,
        country,
        currency,
        totalDividends,
        totalDividendsFiat,
        distributionCount: claims.length,
        tokenBreakdown,
        monthlyBreakdown,
        form1099Div,
        form1042S,
        generatedAt: new Date(),
      };

      return report;
    } catch (error) {
      logger.error('Error generating tax report', { error, holder, taxYear });
      throw error;
    }
  }

  /**
   * Sum total dividends in crypto
   */
  private sumDividends(claims: any[]): string {
    let total = BigInt(0);
    for (const claim of claims) {
      total += BigInt(claim.claimedAmount || '0');
    }
    return total.toString();
  }

  /**
   * Sum total fiat value
   */
  private sumFiatValue(claims: any[]): string {
    let total = 0;
    for (const claim of claims) {
      total += parseFloat(claim.fiatValue || '0');
    }
    return total.toFixed(2);
  }

  /**
   * Generate token-by-token breakdown
   */
  private async generateTokenBreakdown(claims: any[]): Promise<TokenDividendSummary[]> {
    const tokenMap = new Map<string, any>();

    for (const claim of claims) {
      const tokenId = claim.tokenId;
      if (!tokenMap.has(tokenId)) {
        tokenMap.set(tokenId, {
          tokenId,
          assetName: 'Unknown Asset', // Would fetch from database
          assetType: 'property',
          totalDividends: BigInt(0),
          totalDividendsFiat: 0,
          claimCount: 0,
          totalBalance: BigInt(0),
        });
      }

      const token = tokenMap.get(tokenId);
      token.totalDividends += BigInt(claim.claimedAmount || '0');
      token.totalDividendsFiat += parseFloat(claim.fiatValue || '0');
      token.claimCount += 1;
      token.totalBalance += BigInt(claim.tokenBalance || '0');
    }

    return Array.from(tokenMap.values()).map((token) => ({
      tokenId: token.tokenId,
      assetName: token.assetName,
      assetType: token.assetType,
      totalDividends: token.totalDividends.toString(),
      totalDividendsFiat: token.totalDividendsFiat.toFixed(2),
      claimCount: token.claimCount,
      averageTokenBalance: (token.totalBalance / BigInt(token.claimCount)).toString(),
    }));
  }

  /**
   * Generate monthly breakdown
   */
  private generateMonthlyBreakdown(claims: any[]): MonthlyDividendSummary[] {
    const monthMap = new Map<string, any>();

    for (const claim of claims) {
      if (!claim.claimedAt) continue;

      const date = new Date(claim.claimedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          month: date.getMonth() + 1,
          year: date.getFullYear(),
          totalDividends: BigInt(0),
          totalDividendsFiat: 0,
          claimCount: 0,
        });
      }

      const month = monthMap.get(key);
      month.totalDividends += BigInt(claim.claimedAmount || '0');
      month.totalDividendsFiat += parseFloat(claim.fiatValue || '0');
      month.claimCount += 1;
    }

    return Array.from(monthMap.values())
      .map((month) => ({
        month: month.month,
        year: month.year,
        totalDividends: month.totalDividends.toString(),
        totalDividendsFiat: month.totalDividendsFiat.toFixed(2),
        claimCount: month.claimCount,
      }))
      .sort((a, b) => a.month - b.month);
  }

  /**
   * Generate Form 1099-DIV for US taxpayers
   */
  private async generate1099Div(
    holder: string,
    taxYear: number,
    claims: any[]
  ): Promise<Form1099Div> {
    const totalDividendsFiat = this.sumFiatValue(claims);

    return {
      payerName: 'Credit OS Platform',
      payerTIN: '00-0000000', // Platform TIN
      recipientName: holder,
      recipientTIN: '', // Would fetch from user profile
      ordinaryDividends: totalDividendsFiat,
      qualifiedDividends: '0', // Crypto dividends typically not qualified
      totalCapitalGain: '0',
      foreignTaxPaid: '0',
    };
  }

  /**
   * Export report to CSV
   */
  async exportToCSV(report: TaxReport): Promise<string> {
    try {
      let csv = 'Date,Token ID,Asset Name,Amount (Crypto),Amount (Fiat),Transaction Hash\n';

      // Would fetch detailed claim data and format as CSV
      
      return csv;
    } catch (error) {
      logger.error('Error exporting to CSV', { error });
      throw error;
    }
  }

  /**
   * Export report to PDF
   */
  async exportToPDF(report: TaxReport): Promise<Buffer> {
    try {
      // Would use a PDF library to generate formatted report
      logger.info('Exporting to PDF', { holder: report.holder, year: report.taxYear });
      
      return Buffer.from('PDF content');
    } catch (error) {
      logger.error('Error exporting to PDF', { error });
      throw error;
    }
  }

  /**
   * Get exchange rate for a specific date
   */
  private async getExchangeRate(date: Date, currency: string): Promise<number> {
    try {
      // Would integrate with exchange rate API
      // For now, return mock rate
      return 1.0;
    } catch (error) {
      logger.error('Error getting exchange rate', { error, date, currency });
      return 1.0;
    }
  }

  /**
   * Update claim with fiat value
   */
  async updateClaimFiatValue(claimId: string): Promise<void> {
    try {
      const claim = await DividendClaim.findOne({ claimId });
      if (!claim || !claim.claimedAt) return;

      const preference = await DividendPreference.findOne({ holder: claim.holder });
      const currency = preference?.reportingCurrency || 'USD';

      const exchangeRate = await this.getExchangeRate(claim.claimedAt, currency);
      const cryptoAmount = parseFloat(claim.claimedAmount) / 1e9; // Convert from MIST
      const fiatValue = (cryptoAmount * exchangeRate).toFixed(2);

      claim.exchangeRate = exchangeRate;
      claim.fiatValue = fiatValue;
      await claim.save();

      logger.info('Updated claim fiat value', { claimId, fiatValue });
    } catch (error) {
      logger.error('Error updating claim fiat value', { error, claimId });
      throw error;
    }
  }
}

export default TaxReportingService;
