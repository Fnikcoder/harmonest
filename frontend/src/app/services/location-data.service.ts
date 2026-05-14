import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, delay } from 'rxjs/operators';

export interface LocationData {
  city: string;
  state: string;
  country: string;
  timezone: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  marketData: {
    averageHotelPrice: number;
    touristSeason: {
      peak: { start: string; end: string };
      high: { start: string; end: string };
      shoulder: { start: string; end: string };
      low: { start: string; end: string };
    };
    majorEvents: string[];
    economicIndicators: {
      averageIncome: number;
      unemploymentRate: number;
      touristArrivals: number;
    };
  };
}

export interface WeatherData {
  date: string;
  temperature: {
    high: number;
    low: number;
    unit: 'celsius' | 'fahrenheit';
  };
  conditions: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy';
  precipitation: number; // percentage
  windSpeed: number;
  humidity: number;
  uvIndex: number;
  forecast: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface CompetitorData {
  competitorId: string;
  name: string;
  type: 'hotel' | 'apartment' | 'resort' | 'hostel';
  distance: number; // km from target property
  rating: number;
  reviewCount: number;
  similarUnits: {
    unitType: string;
    currentPrice: number;
    availability: number;
    lastUpdated: string;
  }[];
  marketPosition: 'luxury' | 'premium' | 'mid-market' | 'budget';
}

export interface EventData {
  eventId: string;
  name: string;
  type: 'conference' | 'festival' | 'sports' | 'concert' | 'convention' | 'trade_show' | 'cultural' | 'religious';
  category: 'business' | 'entertainment' | 'sports' | 'cultural' | 'educational';
  startDate: string;
  endDate: string;
  venue: string;
  expectedAttendance: number;
  ticketPriceRange: {
    min: number;
    max: number;
    currency: string;
  };
  demographics: {
    ageGroups: { range: string; percentage: number }[];
    incomeLevel: 'low' | 'medium' | 'high' | 'mixed';
    travelDistance: 'local' | 'regional' | 'national' | 'international';
  };
  hotelDemandImpact: {
    radius: number; // km
    demandIncrease: number; // percentage
    priceIncrease: number; // percentage
    confidence: number; // 0-1
  };
}

@Injectable({
  providedIn: 'root'
})
export class LocationDataService {

  constructor() { }

  /**
   * Get location-specific data for pricing optimization
   */
  getLocationData(city: string, state: string, country: string): Observable<LocationData> {
    return of(null).pipe(
      delay(1000),
      map(() => this.getMockLocationData(city, state, country))
    );
  }

  /**
   * Get weather forecast for location
   */
  getWeatherForecast(location: { city: string; state: string; country: string }, days: number = 14): Observable<WeatherData[]> {
    return of(null).pipe(
      delay(800),
      map(() => this.getMockWeatherData(location, days))
    );
  }

  /**
   * Get competitor pricing data
   */
  getCompetitorData(location: { city: string; state: string; country: string }, radius: number = 10): Observable<CompetitorData[]> {
    return of(null).pipe(
      delay(1500),
      map(() => this.getMockCompetitorData(location, radius))
    );
  }

  /**
   * Get local events data
   */
  getLocalEvents(location: { city: string; state: string; country: string }, dateRange: { start: string; end: string }): Observable<EventData[]> {
    return of(null).pipe(
      delay(1200),
      map(() => this.getMockEventData(location, dateRange))
    );
  }

  /**
   * Get holidays for specific location and date range
   */
  getHolidays(country: string, region: string, year: number): Observable<any[]> {
    return of(null).pipe(
      delay(500),
      map(() => this.getMockHolidayData(country, region, year))
    );
  }

  // Mock data methods (in real implementation, these would call external APIs)

  private getMockLocationData(city: string, state: string, country: string): LocationData {
    const locationMap: { [key: string]: Partial<LocationData> } = {
      'San Diego,CA,US': {
        coordinates: { latitude: 32.7157, longitude: -117.1611 },
        marketData: {
          averageHotelPrice: 180,
          touristSeason: {
            peak: { start: '06-01', end: '09-30' },
            high: { start: '04-01', end: '05-31' },
            shoulder: { start: '10-01', end: '11-30' },
            low: { start: '12-01', end: '03-31' }
          },
          majorEvents: ['Comic-Con', 'San Diego County Fair', 'Fleet Week'],
          economicIndicators: {
            averageIncome: 75000,
            unemploymentRate: 4.2,
            touristArrivals: 35000000
          }
        }
      },
      'New York,NY,US': {
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        marketData: {
          averageHotelPrice: 250,
          touristSeason: {
            peak: { start: '09-01', end: '11-30' },
            high: { start: '04-01', end: '06-30' },
            shoulder: { start: '07-01', end: '08-31' },
            low: { start: '12-01', end: '03-31' }
          },
          majorEvents: ['New York Fashion Week', 'Marathon', 'New Year\'s Eve'],
          economicIndicators: {
            averageIncome: 85000,
            unemploymentRate: 3.8,
            touristArrivals: 65000000
          }
        }
      }
    };

    const key = `${city},${state},${country}`;
    const mockData = locationMap[key] || locationMap['San Diego,CA,US'];

    return {
      city,
      state,
      country,
      timezone: 'America/Los_Angeles',
      coordinates: mockData.coordinates!,
      marketData: mockData.marketData!
    };
  }

  private getMockWeatherData(location: any, days: number): WeatherData[] {
    const weatherData: WeatherData[] = [];
    const startDate = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      // Generate realistic weather patterns
      const temp = 70 + Math.sin(i * 0.1) * 10 + (Math.random() - 0.5) * 10;
      const precipitation = Math.random() * 100;
      const conditions = precipitation > 70 ? 'rainy' : 
                        precipitation > 40 ? 'cloudy' : 'sunny';

      weatherData.push({
        date: date.toISOString().split('T')[0],
        temperature: {
          high: Math.round(temp + 5),
          low: Math.round(temp - 5),
          unit: 'fahrenheit'
        },
        conditions,
        precipitation: Math.round(precipitation),
        windSpeed: Math.round(Math.random() * 20),
        humidity: Math.round(50 + Math.random() * 40),
        uvIndex: Math.round(Math.random() * 10),
        forecast: precipitation < 20 && temp > 65 ? 'excellent' :
                 precipitation < 40 && temp > 55 ? 'good' :
                 precipitation < 70 ? 'fair' : 'poor'
      });
    }

    return weatherData;
  }

  private getMockCompetitorData(location: any, radius: number): CompetitorData[] {
    return [
      {
        competitorId: 'comp-001',
        name: 'Luxury Suites Downtown',
        type: 'hotel',
        distance: 2.5,
        rating: 4.5,
        reviewCount: 1250,
        similarUnits: [
          {
            unitType: '1BR1BA',
            currentPrice: 180,
            availability: 15,
            lastUpdated: new Date().toISOString()
          },
          {
            unitType: '2BR2BA',
            currentPrice: 280,
            availability: 8,
            lastUpdated: new Date().toISOString()
          }
        ],
        marketPosition: 'premium'
      },
      {
        competitorId: 'comp-002',
        name: 'Budget Stay Inn',
        type: 'hotel',
        distance: 1.8,
        rating: 3.8,
        reviewCount: 890,
        similarUnits: [
          {
            unitType: '1BR1BA',
            currentPrice: 120,
            availability: 25,
            lastUpdated: new Date().toISOString()
          }
        ],
        marketPosition: 'budget'
      },
      {
        competitorId: 'comp-003',
        name: 'Modern Apartments',
        type: 'apartment',
        distance: 3.2,
        rating: 4.2,
        reviewCount: 650,
        similarUnits: [
          {
            unitType: '1BR1BA',
            currentPrice: 160,
            availability: 12,
            lastUpdated: new Date().toISOString()
          },
          {
            unitType: '2BR2BA',
            currentPrice: 240,
            availability: 6,
            lastUpdated: new Date().toISOString()
          }
        ],
        marketPosition: 'mid-market'
      }
    ];
  }

  private getMockEventData(location: any, dateRange: any): EventData[] {
    return [
      {
        eventId: 'event-001',
        name: 'Tech Conference 2024',
        type: 'conference',
        category: 'business',
        startDate: '2024-08-15',
        endDate: '2024-08-17',
        venue: 'Convention Center',
        expectedAttendance: 15000,
        ticketPriceRange: {
          min: 500,
          max: 1200,
          currency: 'USD'
        },
        demographics: {
          ageGroups: [
            { range: '25-34', percentage: 40 },
            { range: '35-44', percentage: 35 },
            { range: '45-54', percentage: 20 },
            { range: '55+', percentage: 5 }
          ],
          incomeLevel: 'high',
          travelDistance: 'national'
        },
        hotelDemandImpact: {
          radius: 15,
          demandIncrease: 60,
          priceIncrease: 25,
          confidence: 0.9
        }
      },
      {
        eventId: 'event-002',
        name: 'Summer Music Festival',
        type: 'festival',
        category: 'entertainment',
        startDate: '2024-07-20',
        endDate: '2024-07-22',
        venue: 'City Park',
        expectedAttendance: 50000,
        ticketPriceRange: {
          min: 150,
          max: 400,
          currency: 'USD'
        },
        demographics: {
          ageGroups: [
            { range: '18-24', percentage: 35 },
            { range: '25-34', percentage: 40 },
            { range: '35-44', percentage: 20 },
            { range: '45+', percentage: 5 }
          ],
          incomeLevel: 'medium',
          travelDistance: 'regional'
        },
        hotelDemandImpact: {
          radius: 25,
          demandIncrease: 80,
          priceIncrease: 40,
          confidence: 0.85
        }
      }
    ];
  }

  private getMockHolidayData(country: string, region: string, year: number): any[] {
    const holidays = [
      {
        name: 'New Year\'s Day',
        date: `${year}-01-01`,
        type: 'national',
        impactLevel: 'high'
      },
      {
        name: 'Martin Luther King Jr. Day',
        date: `${year}-01-15`,
        type: 'national',
        impactLevel: 'medium'
      },
      {
        name: 'Presidents Day',
        date: `${year}-02-19`,
        type: 'national',
        impactLevel: 'medium'
      },
      {
        name: 'Memorial Day',
        date: `${year}-05-27`,
        type: 'national',
        impactLevel: 'high'
      },
      {
        name: 'Independence Day',
        date: `${year}-07-04`,
        type: 'national',
        impactLevel: 'high'
      },
      {
        name: 'Labor Day',
        date: `${year}-09-02`,
        type: 'national',
        impactLevel: 'high'
      },
      {
        name: 'Thanksgiving',
        date: `${year}-11-28`,
        type: 'national',
        impactLevel: 'high'
      },
      {
        name: 'Christmas Day',
        date: `${year}-12-25`,
        type: 'national',
        impactLevel: 'high'
      }
    ];

    return holidays;
  }
}
