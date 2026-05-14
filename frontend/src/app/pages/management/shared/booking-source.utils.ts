export type BookingSource = 'airbnb' | 'booking_com' | 'homeaway' | 'vrbo' | 'direct' | 'unknown';

export interface BookingSourceInfo {
  source: BookingSource;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
}

/**
 * Determines the booking source based on sourceId and reservationCode
 * @param sourceId - The source ID from the reservation
 * @param reservationCode - The reservation code
 * @param homeAwayReferenceNumber - Optional HomeAway reference number
 * @returns BookingSource
 *
 * Source ID mapping:
 * 1 = Airbnb
 * 2 = Booking.com
 * 3 = HomeAway
 * 4 = VRBO
 * 0 or >100 = Direct booking
 */
export function determineBookingSource(
  sourceId: number | string,
  reservationCode: string,
  homeAwayReferenceNumber?: string
): BookingSource {
  const sourceIdNum = typeof sourceId === 'string' ? parseInt(sourceId) : sourceId;
  const sourceIdStr = sourceId.toString().toLowerCase();
  const reservationCodeUpper = reservationCode?.toUpperCase() || '';

  // 1. Airbnb
  if (
    sourceIdNum === 1 ||
    sourceIdStr.includes('airbnb') ||
    reservationCodeUpper.startsWith('HM') ||
    reservationCodeUpper.includes('AIR')
  ) {
    return 'airbnb';
  }

  // 2. Booking.com
  if (
    sourceIdNum === 2 ||
    sourceIdStr.includes('booking') ||
    reservationCodeUpper.includes('BDC') ||
    (reservationCodeUpper.match(/^\d{8,}$/) && reservationCodeUpper.length >= 8)
  ) {
    return 'booking_com';
  }

  // 3. VRBO (check first as it might have sourceId 3 or 4)
  if (
    sourceIdNum === 4 ||
    sourceIdStr.includes('vrbo') ||
    reservationCodeUpper.includes('VRBO') ||
    reservationCodeUpper.startsWith('HA') ||  // VRBO often uses HA prefix
    reservationCodeUpper.startsWith('VR') ||  // VRBO prefix
    (sourceIdNum === 3 && reservationCodeUpper.match(/^[A-Z]{2}\d+$/)) // Pattern like "HA123456"
  ) {
    return 'vrbo';
  }

  // 4. HomeAway (after VRBO check)
  if (
    sourceIdNum === 3 ||
    sourceIdStr.includes('homeaway') ||
    homeAwayReferenceNumber
  ) {
    return 'homeaway';
  }
  if (
    sourceIdNum === 4 ||
    sourceIdStr.includes('vrbo') ||
    homeAwayReferenceNumber
  ) {
    return 'vrbo';
  }


  // 4. Direct Booking
  if (sourceIdNum === 0 || sourceIdNum > 100) {
    return 'direct';
  }

  // 5. Unknown
  return 'unknown';
}

/**
 * Gets booking source information including display name, icon, and colors
 * @param source - The booking source
 * @returns BookingSourceInfo
 */
export function getBookingSourceInfo(source: BookingSource): BookingSourceInfo {
  const sourceMap: Record<BookingSource, BookingSourceInfo> = {
    airbnb: {
      source: 'airbnb',
      name: 'Airbnb',
      icon: 'home',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20'
    },
    booking_com: {
      source: 'booking_com',
      name: 'Booking.com',
      icon: 'calendar',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    homeaway: {
      source: 'homeaway',
      name: 'HomeAway',
      icon: 'map-pin',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
    },
    vrbo: {
      source: 'vrbo',
      name: 'VRBO',
      icon: 'home',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20'
    },
    direct: {
      source: 'direct',
      name: 'Direct Booking',
      icon: 'user',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    unknown: {
      source: 'unknown',
      name: 'Unknown',
      icon: 'help-circle',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20'
    }
  };

  return sourceMap[source];
}

/**
 * Gets a short display name for the booking source
 * @param source - The booking source
 * @returns Short display name
 */
export function getBookingSourceShortName(source: BookingSource): string {
  const shortNames: Record<BookingSource, string> = {
    airbnb: 'ABB',
    booking_com: 'BDC',
    homeaway: 'HomeAway',
    vrbo: 'VRBO',
    direct: 'Direct',
    unknown: '?'
  };

  return shortNames[source];
}

/**
 * Creates a booking source badge HTML for display
 * @param source - The booking source
 * @param showIcon - Whether to show the icon
 * @param showText - Whether to show the text
 * @returns HTML string for the badge
 */
export function createBookingSourceBadge(
  source: BookingSource,
  showIcon: boolean = true,
  showText: boolean = true
): string {
  const info = getBookingSourceInfo(source);
  const shortName = getBookingSourceShortName(source);

  let content = '';
  if (showIcon) {
    content += `<i data-feather="${info.icon}" class="size-3 ${info.color}"></i>`;
  }
  if (showText) {
    content += showIcon ? ` ${shortName}` : shortName;
  }

  return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${info.bgColor} ${info.color}" title="${info.name}">${content}</span>`;
}


