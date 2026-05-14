import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, delay } from 'rxjs/operators';

// Interfaces for price optimization
export interface PriceOptimizationRequest {
  propertyGroupId: string;
  unitModelId: string;
  location: {
    city: string;
    state: string;
    country: string;
    timezone: string;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
  currentPrice: number;
  basePrice: number;
  occupancyRate: number;
  availableUnits: number;
  totalUnits: number;
}

export interface PriceOptimizationResult {
  optimizedPrices: {
    date: string;
    price: number;
    originalPrice: number;
    priceChange: number;
    priceChangePercent: number;
    factors: PriceFactor[];
    confidence: number;
  }[];
  summary: {
    averagePrice: number;
    totalRevenue: number;
    revenueIncrease: number;
    revenueIncreasePercent: number;
    riskScore: number;
  };
  recommendations: string[];
}

export interface PriceFactor {
  type: 'weekend' | 'holiday' | 'local_event' | 'seasonal' | 'demand' | 'occupancy' | 'weather' | 'competition';
  name: string;
  impact: number; // -1.0 to 1.0 (negative = decrease, positive = increase)
  multiplier: number; // actual price multiplier
  confidence: number; // 0.0 to 1.0
  description: string;
}

export interface LocalEvent {
  id: string;
  name: string;
  type: 'conference' | 'festival' | 'sports' | 'concert' | 'holiday' | 'convention' | 'trade_show';
  startDate: string;
  endDate: string;
  location: string;
  expectedAttendance?: number;
  impactRadius: number; // km
  demandMultiplier: number;
  confidence: number;
}

export interface Holiday {
  name: string;
  date: string;
  type: 'national' | 'regional' | 'religious' | 'cultural';
  country: string;
  region?: string;
  impactLevel: 'low' | 'medium' | 'high';
  demandMultiplier: number;
}

@Injectable({
  providedIn: 'root'
})
export class PriceOptimizationService {

  constructor() { }

  /**
   * Main price optimization method
   */
  optimizePrices(request: PriceOptimizationRequest): Observable<PriceOptimizationResult> {
    return of(null).pipe(
      delay(2000), // Simulate API processing time
      map(() => {
        const optimizedPrices = this.calculateOptimizedPrices(request);
        const summary = this.calculateSummary(optimizedPrices, request);
        const recommendations = this.generateRecommendations(request, optimizedPrices);

        return {
          optimizedPrices,
          summary,
          recommendations
        };
      })
    );
  }

  /**
   * Calculate optimized prices for each date in the range
   */
  private calculateOptimizedPrices(request: PriceOptimizationRequest): any[] {
    const prices = [];
    const startDate = new Date(request.dateRange.startDate);
    const endDate = new Date(request.dateRange.endDate);

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const factors = this.analyzePriceFactors(date, request);
      const optimizedPrice = this.applyPriceFactors(request.basePrice, factors);

      prices.push({
        date: dateStr,
        price: Math.round(optimizedPrice * 100) / 100,
        originalPrice: request.currentPrice,
        priceChange: optimizedPrice - request.currentPrice,
        priceChangePercent: ((optimizedPrice - request.currentPrice) / request.currentPrice) * 100,
        factors,
        confidence: this.calculateConfidence(factors)
      });
    }

    return prices;
  }

  /**
   * Analyze all price factors for a specific date
   */
  private analyzePriceFactors(date: Date, request: PriceOptimizationRequest): PriceFactor[] {
    const factors: PriceFactor[] = [];

    // Weekend factor
    factors.push(...this.getWeekendFactors(date, request.location));

    // Holiday factors
    factors.push(...this.getHolidayFactors(date, request.location));

    // Local events
    factors.push(...this.getLocalEventFactors(date, request.location));

    // Seasonal factors
    factors.push(...this.getSeasonalFactors(date, request.location));

    // Demand factors
    factors.push(...this.getDemandFactors(date, request));

    // Occupancy factors
    factors.push(...this.getOccupancyFactors(request));

    // Weather factors (mock)
    factors.push(...this.getWeatherFactors(date, request.location));

    return factors;
  }

  /**
   * Weekend pricing factors
   */
  private getWeekendFactors(date: Date, location: any): PriceFactor[] {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const factors: PriceFactor[] = [];

    if (dayOfWeek === 5) { // Friday
      factors.push({
        type: 'weekend',
        name: 'Friday Premium',
        impact: 0.15,
        multiplier: 1.15,
        confidence: 0.9,
        description: 'Friday night premium pricing'
      });
    } else if (dayOfWeek === 6) { // Saturday
      factors.push({
        type: 'weekend',
        name: 'Saturday Premium',
        impact: 0.25,
        multiplier: 1.25,
        confidence: 0.95,
        description: 'Saturday night premium pricing'
      });
    } else if (dayOfWeek === 0) { // Sunday
      factors.push({
        type: 'weekend',
        name: 'Sunday Premium',
        impact: 0.1,
        multiplier: 1.1,
        confidence: 0.8,
        description: 'Sunday night moderate premium'
      });
    } else if (dayOfWeek >= 1 && dayOfWeek <= 4) { // Monday-Thursday
      factors.push({
        type: 'weekend',
        name: 'Weekday Discount',
        impact: -0.1,
        multiplier: 0.9,
        confidence: 0.85,
        description: 'Weekday competitive pricing'
      });
    }

    return factors;
  }

  /**
   * Holiday pricing factors
   */
  private getHolidayFactors(date: Date, location: any): PriceFactor[] {
    const holidays = this.getHolidaysForLocation(location);
    const factors: PriceFactor[] = [];
    const dateStr = date.toISOString().split('T')[0];

    for (const holiday of holidays) {
      const holidayDate = new Date(holiday.date);
      const daysDiff = Math.abs((date.getTime() - holidayDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 3) { // Within 3 days of holiday
        let impact = 0;
        let multiplier = 1;

        switch (holiday.impactLevel) {
          case 'high':
            impact = daysDiff === 0 ? 0.5 : (daysDiff === 1 ? 0.3 : 0.15);
            break;
          case 'medium':
            impact = daysDiff === 0 ? 0.3 : (daysDiff === 1 ? 0.2 : 0.1);
            break;
          case 'low':
            impact = daysDiff === 0 ? 0.15 : 0.05;
            break;
        }

        multiplier = 1 + impact;

        factors.push({
          type: 'holiday',
          name: holiday.name,
          impact,
          multiplier,
          confidence: daysDiff === 0 ? 0.95 : (daysDiff === 1 ? 0.85 : 0.7),
          description: `${holiday.name} holiday impact (${daysDiff} days ${daysDiff === 0 ? 'on' : 'from'} holiday)`
        });
      }
    }

    return factors;
  }

  /**
   * Local events pricing factors
   */
  private getLocalEventFactors(date: Date, location: any): PriceFactor[] {
    const events = this.getLocalEventsForLocation(location);
    const factors: PriceFactor[] = [];

    for (const event of events) {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);

      if (date >= eventStart && date <= eventEnd) {
        factors.push({
          type: 'local_event',
          name: event.name,
          impact: event.demandMultiplier - 1,
          multiplier: event.demandMultiplier,
          confidence: event.confidence,
          description: `${event.type} event: ${event.name}`
        });
      }
    }

    return factors;
  }

  /**
   * Seasonal pricing factors
   */
  private getSeasonalFactors(date: Date, location: any): PriceFactor[] {
    const factors: PriceFactor[] = [];
    const month = date.getMonth(); // 0-11
    const season = this.getSeason(month, location);

    let seasonalMultiplier = 1;
    let impact = 0;

    // Adjust based on location and season
    switch (season) {
      case 'peak':
        seasonalMultiplier = 1.3;
        impact = 0.3;
        break;
      case 'high':
        seasonalMultiplier = 1.15;
        impact = 0.15;
        break;
      case 'shoulder':
        seasonalMultiplier = 1.0;
        impact = 0;
        break;
      case 'low':
        seasonalMultiplier = 0.85;
        impact = -0.15;
        break;
    }

    if (impact !== 0) {
      factors.push({
        type: 'seasonal',
        name: `${season.charAt(0).toUpperCase() + season.slice(1)} Season`,
        impact,
        multiplier: seasonalMultiplier,
        confidence: 0.8,
        description: `${season} season pricing adjustment`
      });
    }

    return factors;
  }

  /**
   * Demand-based pricing factors
   */
  private getDemandFactors(date: Date, request: PriceOptimizationRequest): PriceFactor[] {
    const factors: PriceFactor[] = [];
    
    // Mock demand calculation based on advance booking
    const daysInAdvance = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysInAdvance <= 7) {
      factors.push({
        type: 'demand',
        name: 'Last Minute Booking',
        impact: 0.1,
        multiplier: 1.1,
        confidence: 0.75,
        description: 'Last minute booking premium'
      });
    } else if (daysInAdvance >= 60) {
      factors.push({
        type: 'demand',
        name: 'Early Bird Discount',
        impact: -0.05,
        multiplier: 0.95,
        confidence: 0.8,
        description: 'Early booking discount'
      });
    }

    return factors;
  }

  /**
   * Occupancy-based pricing factors
   */
  private getOccupancyFactors(request: PriceOptimizationRequest): PriceFactor[] {
    const factors: PriceFactor[] = [];
    const occupancyRate = request.occupancyRate;

    if (occupancyRate > 0.85) {
      factors.push({
        type: 'occupancy',
        name: 'High Occupancy Premium',
        impact: 0.15,
        multiplier: 1.15,
        confidence: 0.9,
        description: 'High demand due to limited availability'
      });
    } else if (occupancyRate < 0.5) {
      factors.push({
        type: 'occupancy',
        name: 'Low Occupancy Discount',
        impact: -0.1,
        multiplier: 0.9,
        confidence: 0.85,
        description: 'Competitive pricing to increase bookings'
      });
    }

    return factors;
  }

  /**
   * Weather-based pricing factors (mock)
   */
  private getWeatherFactors(date: Date, location: any): PriceFactor[] {
    const factors: PriceFactor[] = [];
    
    // Mock weather impact (in real implementation, integrate with weather API)
    const randomWeatherFactor = Math.random();
    
    if (randomWeatherFactor > 0.8) {
      factors.push({
        type: 'weather',
        name: 'Perfect Weather',
        impact: 0.05,
        multiplier: 1.05,
        confidence: 0.6,
        description: 'Excellent weather forecast increases demand'
      });
    } else if (randomWeatherFactor < 0.2) {
      factors.push({
        type: 'weather',
        name: 'Poor Weather',
        impact: -0.05,
        multiplier: 0.95,
        confidence: 0.6,
        description: 'Poor weather forecast may reduce demand'
      });
    }

    return factors;
  }

  /**
   * Apply all price factors to calculate final price
   */
  private applyPriceFactors(basePrice: number, factors: PriceFactor[]): number {
    let finalPrice = basePrice;
    
    // Apply each factor
    for (const factor of factors) {
      finalPrice *= factor.multiplier;
    }

    // Ensure price doesn't go below 50% or above 300% of base price
    const minPrice = basePrice * 0.5;
    const maxPrice = basePrice * 3.0;
    
    return Math.max(minPrice, Math.min(maxPrice, finalPrice));
  }

  /**
   * Calculate confidence score based on factors
   */
  private calculateConfidence(factors: PriceFactor[]): number {
    if (factors.length === 0) return 0.5;
    
    const avgConfidence = factors.reduce((sum, factor) => sum + factor.confidence, 0) / factors.length;
    return Math.round(avgConfidence * 100) / 100;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(optimizedPrices: any[], request: PriceOptimizationRequest): any {
    const totalDays = optimizedPrices.length;
    const averagePrice = optimizedPrices.reduce((sum, p) => sum + p.price, 0) / totalDays;
    const totalRevenue = optimizedPrices.reduce((sum, p) => sum + p.price, 0);
    const originalRevenue = request.currentPrice * totalDays;
    const revenueIncrease = totalRevenue - originalRevenue;
    const revenueIncreasePercent = (revenueIncrease / originalRevenue) * 100;

    // Calculate risk score based on price volatility
    const priceChanges = optimizedPrices.map(p => Math.abs(p.priceChangePercent));
    const avgPriceChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
    const riskScore = Math.min(1.0, avgPriceChange / 50); // Normalize to 0-1

    return {
      averagePrice: Math.round(averagePrice * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      revenueIncrease: Math.round(revenueIncrease * 100) / 100,
      revenueIncreasePercent: Math.round(revenueIncreasePercent * 100) / 100,
      riskScore: Math.round(riskScore * 100) / 100
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(request: PriceOptimizationRequest, optimizedPrices: any[]): string[] {
    const recommendations: string[] = [];
    
    const avgIncrease = optimizedPrices.reduce((sum, p) => sum + p.priceChangePercent, 0) / optimizedPrices.length;
    
    if (avgIncrease > 10) {
      recommendations.push('Consider implementing gradual price increases to avoid demand shock');
    }
    
    if (request.occupancyRate > 0.9) {
      recommendations.push('High occupancy detected - consider premium pricing strategy');
    }
    
    if (request.occupancyRate < 0.4) {
      recommendations.push('Low occupancy - consider promotional pricing or marketing campaigns');
    }
    
    const weekendPrices = optimizedPrices.filter(p => {
      const date = new Date(p.date);
      const day = date.getDay();
      return day === 5 || day === 6; // Friday or Saturday
    });
    
    if (weekendPrices.length > 0) {
      const avgWeekendIncrease = weekendPrices.reduce((sum, p) => sum + p.priceChangePercent, 0) / weekendPrices.length;
      if (avgWeekendIncrease > 20) {
        recommendations.push('Weekend pricing shows strong premium potential');
      }
    }
    
    return recommendations;
  }

  // Helper methods for data (in real implementation, these would come from APIs/databases)
  
  private getHolidaysForLocation(location: any): Holiday[] {
    // Mock holiday data - in real implementation, integrate with holiday API
    const holidays: Holiday[] = [
      {
        name: 'New Year\'s Day',
        date: '2024-01-01',
        type: 'national',
        country: 'US',
        impactLevel: 'high',
        demandMultiplier: 1.4
      },
      {
        name: 'Independence Day',
        date: '2024-07-04',
        type: 'national',
        country: 'US',
        impactLevel: 'high',
        demandMultiplier: 1.5
      },
      {
        name: 'Christmas Day',
        date: '2024-12-25',
        type: 'national',
        country: 'US',
        impactLevel: 'high',
        demandMultiplier: 1.6
      },
      {
        name: 'Thanksgiving',
        date: '2024-11-28',
        type: 'national',
        country: 'US',
        impactLevel: 'high',
        demandMultiplier: 1.3
      }
    ];
    
    return holidays.filter(h => h.country === location.country);
  }

  private getLocalEventsForLocation(location: any): LocalEvent[] {
    // Mock local events - in real implementation, integrate with events API
    return [
      {
        id: 'comic-con-2024',
        name: 'Comic-Con International',
        type: 'convention',
        startDate: '2024-07-25',
        endDate: '2024-07-28',
        location: 'San Diego, CA',
        expectedAttendance: 130000,
        impactRadius: 50,
        demandMultiplier: 2.0,
        confidence: 0.95
      },
      {
        id: 'music-festival-2024',
        name: 'Summer Music Festival',
        type: 'festival',
        startDate: '2024-08-15',
        endDate: '2024-08-17',
        location: location.city,
        expectedAttendance: 50000,
        impactRadius: 25,
        demandMultiplier: 1.5,
        confidence: 0.85
      }
    ];
  }

  private getSeason(month: number, location: any): 'peak' | 'high' | 'shoulder' | 'low' {
    // Simplified seasonal logic - in real implementation, consider location-specific seasons
    if (location.country === 'US') {
      if (month >= 5 && month <= 8) return 'peak'; // June-September
      if (month >= 3 && month <= 4 || month >= 9 && month <= 10) return 'high'; // Apr-May, Oct-Nov
      if (month === 2 || month === 11) return 'shoulder'; // March, December
      return 'low'; // Jan-Feb
    }
    
    return 'shoulder'; // Default
  }
}
