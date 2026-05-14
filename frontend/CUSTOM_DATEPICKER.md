# Custom Datepicker Component

## Overview
I've created a custom datepicker component that displays two months side by side and prevents selection of past dates. This component replaces the Angular Material datepicker to provide better control and user experience.

## Features

### ✅ **Two-Month Display**
- Always shows two consecutive months
- Easy navigation between months
- Clear month/year headers

### ✅ **Past Date Prevention**
- Past dates are automatically disabled
- Visual indication of disabled dates
- Only current and future dates are selectable

### ✅ **Range Selection**
- Click to select start date
- Click again to select end date
- Visual indication of selected range
- Range highlighting between dates

### ✅ **User Experience**
- Modal overlay with backdrop
- Responsive design for mobile and desktop
- Clear visual feedback for selections
- Today indicator
- Night count display

### ✅ **Design Integration**
- Matches your existing design system
- Uses Tailwind CSS classes
- Dark mode support
- Consistent with your color scheme (red primary)

## Usage

### Basic Implementation
```typescript
// In your component
showDatepicker = false;
selectedRange = { start: null, end: null };

openDatepicker(): void {
  this.showDatepicker = true;
}

closeDatepicker(): void {
  this.showDatepicker = false;
}

onDateRangeSelected(dateRange: { start: Date | null; end: Date | null }): void {
  this.selectedRange = dateRange;
  // Update your form or handle the selection
}
```

### Template Usage
```html
<!-- Trigger Button -->
<input
  type="text"
  readonly
  (click)="openDatepicker()"
  [value]="selectedRange.start && selectedRange.end 
    ? (selectedRange.start | date:'MMM dd, yyyy') + ' - ' + (selectedRange.end | date:'MMM dd, yyyy')
    : ''"
  placeholder="Select your stay dates"
/>

<!-- Datepicker Component -->
<app-custom-datepicker
  [isOpen]="showDatepicker"
  [selectedRange]="selectedRange"
  (dateRangeSelected)="onDateRangeSelected($event)"
  (closeCalendar)="closeDatepicker()">
</app-custom-datepicker>
```

## Component API

### Inputs
- `isOpen: boolean` - Controls visibility of the datepicker modal
- `selectedRange: { start: Date | null; end: Date | null }` - Current selected date range

### Outputs
- `dateRangeSelected: EventEmitter<{ start: Date | null; end: Date | null }>` - Emitted when dates are selected
- `closeCalendar: EventEmitter<void>` - Emitted when calendar should be closed

## Integration Points

### Updated Components
1. **FormComponent** (`src/app/components/form/form.component.ts`)
   - Replaced Angular Material datepicker
   - Added custom datepicker integration

2. **FormSingleListingComponent** (`src/app/components/form-single-listing/form-single-listing.component.ts`)
   - Updated to use custom datepicker
   - Maintains existing functionality

3. **BookingStepOneComponent** (`src/app/components/booking-step-one/booking-step-one.component.ts`)
   - Integrated custom datepicker
   - Form validation support

## Key Features Implemented

### 🚫 **Past Date Prevention**
- Automatically disables all dates before today
- Visual styling for disabled dates
- Prevents user interaction with past dates

### 📅 **Two-Month View**
- Always displays current month and next month
- Navigation arrows to move between months
- Consistent two-month layout

### 🎯 **Range Selection Logic**
- First click sets start date
- Second click sets end date
- If second click is before start date, it becomes new start date
- Visual feedback during selection process

### 🎨 **Visual Design**
- Selected dates highlighted in red
- Range dates have light red background
- Today indicator with red dot
- Hover effects and transitions
- Responsive grid layout

### 📱 **Responsive Design**
- Mobile-friendly layout
- Stacked months on small screens
- Touch-friendly button sizes
- Proper spacing and typography

## Technical Implementation

### State Management
- Internal state for calendar generation
- Reactive updates when dates change
- Proper cleanup and event handling

### Calendar Logic
- Dynamic month generation
- Proper handling of month boundaries
- Leap year support
- Week grid layout (42 days per month)

### Accessibility
- Keyboard navigation support
- Focus management
- Screen reader friendly
- Proper ARIA attributes

## Benefits Over Angular Material

1. **Better Control**: Full control over appearance and behavior
2. **No Dependencies**: Removes Angular Material dependency
3. **Custom Features**: Two-month view and past date prevention
4. **Design Consistency**: Matches your exact design requirements
5. **Performance**: Lighter weight than Material components
6. **Flexibility**: Easy to customize and extend

## Testing

To test the custom datepicker:

1. Navigate to any page with a form (home page, booking page)
2. Click on the date input field
3. Verify two months are displayed
4. Try to click on past dates (should be disabled)
5. Select a date range and verify it works correctly
6. Test on mobile devices for responsiveness

The custom datepicker is now fully integrated and ready for use across your application!
