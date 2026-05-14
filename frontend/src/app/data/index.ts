// Data Model Exports
export * from '../interfaces/property.interface';
export * from '../interfaces/user.interface';
export * from '../interfaces/booking.interface';
export * from '../interfaces/payment.interface';
export * from '../interfaces/qrcode.interface';

// Mock Data Imports
import propertyGroupsData from './property-groups.json';
import unitModelsData from './unit-models.json';
import individualUnitsData from './individual-units.json';
import usersData from './users.json';
import bookingsData from './bookings.json';
import paymentsData from './payments.json';
import qrCodesData from './qrcodes.json';
import checkInsData from './checkins.json';
import unitModelsDisplayData from './unit-models-display.json';
import analyticsData from './analytics.json';

// Legacy data (keeping for backward compatibility)
import packagesData from './packages.json';

// Type-safe data exports
export const mockData = {
  // Core entities
  propertyGroups: propertyGroupsData,
  unitModels: unitModelsData,
  individualUnits: individualUnitsData,
  users: usersData,
  bookings: bookingsData,
  payments: paymentsData,
  qrCodes: qrCodesData,
  checkIns: checkInsData,

  // Display/UI optimized data
  unitModelsDisplay: unitModelsDisplayData,

  // Analytics data
  analytics: analyticsData,

  // Legacy data
  packages: packagesData
};

// Data relationships helper
export const dataRelationships = {
  // Get unit models for a property group
  getUnitModelsByPropertyGroup: (propertyGroupId: string) => {
    return mockData.unitModels.filter(model => model.groupId === propertyGroupId);
  },

  // Get individual units for a unit model
  getIndividualUnitsByModel: (modelId: string) => {
    return mockData.individualUnits.filter(unit => unit.modelId === modelId);
  },

  // Get bookings for a user
  getBookingsByUser: (userId: string) => {
    return mockData.bookings.filter(booking => booking.userId === userId);
  },

  // Get payments for a booking
  getPaymentsByBooking: (bookingId: string) => {
    return mockData.payments.filter(payment => payment.bookingId === bookingId);
  },

  // Get QR codes for a booking
  getQRCodesByBooking: (bookingId: string) => {
    return mockData.qrCodes.filter(qr => qr.bookingId === bookingId);
  },

  // Get available units for a property group
  getAvailableUnits: (propertyGroupId: string) => {
    const models = mockData.unitModels.filter(model => model.groupId === propertyGroupId);
    const availableUnits: any[] = [];

    models.forEach(model => {
      const units = mockData.individualUnits.filter(unit =>
        unit.modelId === model.modelId &&
        unit.status.availability === 'available'
      );
      availableUnits.push(...units);
    });

    return availableUnits;
  },

  // Get property group summary
  getPropertyGroupSummary: (propertyGroupId: string) => {
    const propertyGroup = mockData.propertyGroups.find(pg => pg.groupId === propertyGroupId);
    const models = mockData.unitModels.filter(model => model.groupId === propertyGroupId);
    const allUnits = mockData.individualUnits.filter(unit =>
      models.some(model => model.modelId === unit.modelId)
    );

    const totalUnits = allUnits.length;
    const availableUnits = allUnits.filter(unit => unit.status.availability === 'available').length;
    const occupiedUnits = allUnits.filter(unit => unit.status.availability === 'occupied').length;
    const maintenanceUnits = allUnits.filter(unit => unit.status.availability === 'maintenance').length;

    const priceRange = {
      min: Math.min(...models.map(model => model.pricing.basePrice)),
      max: Math.max(...models.map(model => model.pricing.basePrice)),
      currency: models[0]?.pricing.currency || 'USD'
    };

    return {
      propertyGroup,
      models,
      inventory: {
        totalUnits,
        availableUnits,
        occupiedUnits,
        maintenanceUnits,
        occupancyRate: totalUnits > 0 ? occupiedUnits / totalUnits : 0
      },
      priceRange
    };
  },

  // Get user booking history with details
  getUserBookingHistory: (userId: string) => {
    const userBookings = mockData.bookings.filter(booking => booking.userId === userId);

    return userBookings.map(booking => {
      const payments = mockData.payments.filter(payment => payment.bookingId === booking.bookingId);
      const qrCodes = mockData.qrCodes.filter(qr => qr.bookingId === booking.bookingId);
      const propertyGroup = mockData.propertyGroups.find(pg => pg.groupId === booking.propertyGroupId);

      return {
        ...booking,
        propertyGroup,
        payments,
        qrCodes
      };
    });
  }
};

// Data validation helpers
export const dataValidation = {
  // Validate property group data
  validatePropertyGroup: (data: any): boolean => {
    return !!(data.groupId && data.name && data.address && data.contact);
  },

  // Validate unit model data
  validateUnitModel: (data: any): boolean => {
    return !!(data.modelId && data.groupId && data.name && data.configuration && data.pricing);
  },

  // Validate booking data
  validateBooking: (data: any): boolean => {
    return !!(data.bookingId && data.userId && data.propertyGroupId && data.stay && data.primaryGuest);
  },

  // Validate payment data
  validatePayment: (data: any): boolean => {
    return !!(data.paymentId && data.bookingId && data.userId && data.amount && data.paymentMethod);
  },

  // Validate QR code data
  validateQRCode: (data: any): boolean => {
    return !!(data.qrCodeId && data.bookingId && data.unitId && data.code && data.access);
  }
};

// Data statistics
export const dataStatistics = {
  // Get overall statistics
  getOverallStats: () => {
    return {
      propertyGroups: mockData.propertyGroups.length,
      unitModels: mockData.unitModels.length,
      individualUnits: mockData.individualUnits.length,
      users: mockData.users.length,
      bookings: mockData.bookings.length,
      payments: mockData.payments.length,
      qrCodes: mockData.qrCodes.length,

      // Calculated stats
      averageOccupancyRate: mockData.unitModels.reduce((acc, model) =>
        acc + (model.inventory.occupiedUnits / model.inventory.totalUnits), 0
      ) / mockData.unitModels.length,

      totalRevenue: mockData.payments
        .filter(payment => payment.transaction.status === 'succeeded')
        .reduce((acc, payment) => acc + payment.amount.total, 0),

      averageBookingValue: mockData.bookings.length > 0
        ? mockData.bookings.reduce((acc, booking) => acc + booking.pricing.total, 0) / mockData.bookings.length
        : 0
    };
  },

  // Get property group performance
  getPropertyGroupPerformance: (propertyGroupId: string) => {
    const bookings = mockData.bookings.filter(booking => booking.propertyGroupId === propertyGroupId);
    const payments = mockData.payments.filter(payment =>
      bookings.some(booking => booking.bookingId === payment.bookingId)
    );

    const totalRevenue = payments
      .filter(payment => payment.transaction.status === 'succeeded')
      .reduce((acc, payment) => acc + payment.amount.total, 0);

    const averageBookingValue = bookings.length > 0
      ? bookings.reduce((acc, booking) => acc + booking.pricing.total, 0) / bookings.length
      : 0;

    return {
      totalBookings: bookings.length,
      totalRevenue,
      averageBookingValue,
      bookingStatuses: {
        confirmed: bookings.filter(b => b.status === 'confirmed').length,
        pending: bookings.filter(b => b.status === 'pending').length,
        checked_in: bookings.filter(b => b.status === 'checked_in').length,
        checked_out: bookings.filter(b => b.status === 'checked_out').length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length
      }
    };
  }
};

// Export default for convenience
export default mockData;
