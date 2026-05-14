import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ModelService } from '../../../../services/model.service';
import { PropertyGroup } from '../../../../interfaces/property.interface';

@Component({
  selector: 'app-property-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Property Groups</h1>
          <p class="text-gray-600 dark:text-gray-400">Manage your property locations and buildings</p>
        </div>
        <button (click)="showCreateModal = true"
                class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          <i class="fas fa-plus mr-2"></i>
          Add Property Group
        </button>
      </div>

      <!-- Learning Section -->
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div class="flex items-start space-x-3">
          <i class="fas fa-lightbulb text-blue-600 dark:text-blue-400 mt-1"></i>
          <div>
            <h3 class="text-sm font-medium text-blue-900 dark:text-blue-100">Property Groups Learning</h3>
            <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Property groups represent buildings or locations that contain multiple units. Each group can have different unit types (models) with varying quantities and pricing.
            </p>
            <button (click)="showLearning = !showLearning"
                    class="text-blue-600 dark:text-blue-400 text-sm font-medium mt-2 hover:underline">
              {{ showLearning ? 'Hide' : 'Show' }} detailed guide
            </button>
          </div>
        </div>

        <div *ngIf="showLearning" class="mt-4 pl-6 space-y-2 text-sm text-blue-700 dark:text-blue-300">
          <p><strong>Best Practices:</strong></p>
          <ul class="list-disc list-inside space-y-1 ml-4">
            <li>Use descriptive names that include location (e.g., "Downtown Berlin Apartments")</li>
            <li>Add detailed descriptions with neighborhood highlights</li>
            <li>Include high-quality photos for each property group</li>
            <li>Set accurate coordinates for map display</li>
            <li>Configure amenities that apply to the entire building/location</li>
          </ul>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
            <input [(ngModel)]="searchTerm"
                   (input)="filterProperties()"
                   type="text"
                   placeholder="Search properties..."
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</label>
            <select [(ngModel)]="selectedLocation"
                    (change)="filterProperties()"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
              <option value="">All Locations</option>
              <option *ngFor="let location of uniqueLocations" [value]="location">{{ location }}</option>
            </select>
          </div>
          <div class="flex items-end">
            <button (click)="clearFilters()"
                    class="w-full px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <!-- Properties Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div *ngFor="let property of filteredProperties"
             class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">

          <!-- Property Image -->
          <div class="h-48 bg-gray-200 dark:bg-gray-700 relative">
            <img *ngIf="property.media.images && property.media.images.length > 0"
                 [src]="property.media.images[0]"
                 [alt]="property.name"
                 class="w-full h-full object-cover">
            <div *ngIf="!property.media.images || property.media.images.length === 0"
                 class="w-full h-full flex items-center justify-center">
              <i class="fas fa-building text-gray-400 text-4xl"></i>
            </div>

            <!-- Status Badge -->
            <div class="absolute top-3 right-3">
              <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                    [ngClass]="getStatusBadgeClass(property.status)">
                {{ property.status | titlecase }}
              </span>
            </div>
          </div>

          <!-- Property Info -->
          <div class="p-6">
            <div class="flex items-start justify-between mb-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ property.name }}</h3>
              <div class="flex space-x-2">
                <button (click)="editProperty(property)"
                        class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400">
                  <i class="fas fa-edit"></i>
                </button>
                <button (click)="deleteProperty(property)"
                        class="text-red-600 hover:text-red-900 dark:text-red-400">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>

            <p class="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
              {{ property.description }}
            </p>

            <div class="space-y-2 text-sm">
              <div class="flex items-center text-gray-600 dark:text-gray-400">
                <i class="fas fa-map-marker-alt w-4 mr-2"></i>
                {{ property.address.city }}, {{ property.address.country }}
              </div>
              <div class="flex items-center text-gray-600 dark:text-gray-400">
                <i class="fas fa-door-open w-4 mr-2"></i>
                {{ getTotalUnits(property) }} units
              </div>
              <div class="flex items-center text-gray-600 dark:text-gray-400">
                <i class="fas fa-euro-sign w-4 mr-2"></i>
                From €{{ getMinPrice(property) }}/night
              </div>
            </div>

            <!-- Amenities -->
            <div *ngIf="property.amenities && property.amenities.length > 0" class="mt-4">
              <div class="flex flex-wrap gap-1">
                <span *ngFor="let amenity of property.amenities.slice(0, 3)"
                      class="inline-flex px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                  {{ amenity }}
                </span>
                <span *ngIf="property.amenities.length > 3"
                      class="inline-flex px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                  +{{ property.amenities.length - 3 }} more
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="mt-4 flex space-x-2">
              <a [routerLink]="['/management/properties/groups', property.groupId]"
                 class="flex-1 bg-red-600 hover:bg-red-700 text-white text-center py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                View Details
              </a>
              <button (click)="togglePropertyStatus(property)"
                      class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors">
                {{ property.status === 'active' ? 'Deactivate' : 'Activate' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="filteredProperties.length === 0" class="text-center py-12">
        <i class="fas fa-building text-gray-400 text-4xl mb-4"></i>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No properties found</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-4">Get started by creating your first property group.</p>
        <button (click)="showCreateModal = true"
                class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          <i class="fas fa-plus mr-2"></i>
          Add Property Group
        </button>
      </div>
    </div>

    <!-- Create/Edit Property Modal -->
    <div *ngIf="showCreateModal || showEditModal"
         class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ showCreateModal ? 'Create Property Group' : 'Edit Property Group' }}
            </h3>
            <button (click)="closeModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <form [formGroup]="propertyForm" (ngSubmit)="saveProperty()" class="p-6">
          <div class="space-y-6">
            <!-- Basic Information -->
            <div>
              <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Basic Information</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Property Name</label>
                  <input formControlName="name"
                         type="text"
                         placeholder="e.g., Downtown Berlin Apartments"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                </div>
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                  <textarea formControlName="description"
                            rows="3"
                            placeholder="Describe your property, location highlights, and amenities..."
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"></textarea>
                </div>
              </div>
            </div>

            <!-- Address -->
            <div>
              <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Address</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Street Address</label>
                  <input formControlName="street"
                         type="text"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">City</label>
                  <input formControlName="city"
                         type="text"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Postal Code</label>
                  <input formControlName="postalCode"
                         type="text"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Country</label>
                  <select formControlName="country"
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                    <option value="">Select Country</option>
                    <option value="Germany">Germany</option>
                    <option value="Austria">Austria</option>
                    <option value="Switzerland">Switzerland</option>
                    <option value="Netherlands">Netherlands</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">State/Region</label>
                  <input formControlName="state"
                         type="text"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                </div>
              </div>
            </div>

            <!-- Coordinates -->
            <div>
              <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Location Coordinates</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Latitude</label>
                  <input formControlName="latitude"
                         type="number"
                         step="any"
                         placeholder="52.5200"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Longitude</label>
                  <input formControlName="longitude"
                         type="number"
                         step="any"
                         placeholder="13.4050"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button type="button"
                    (click)="closeModal()"
                    class="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button type="submit"
                    [disabled]="!propertyForm.valid"
                    class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {{ showCreateModal ? 'Create Property' : 'Update Property' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class PropertyGroupsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  properties: PropertyGroup[] = [];
  filteredProperties: PropertyGroup[] = [];

  searchTerm = '';
  selectedLocation = '';

  showCreateModal = false;
  showEditModal = false;
  showLearning = false;
  editingProperty: PropertyGroup | null = null;

  propertyForm: FormGroup;

  get uniqueLocations(): string[] {
    return [...new Set(this.properties.map(p => p.address?.city).filter(Boolean))];
  }

  constructor(
    private modelService: ModelService,
    private fb: FormBuilder
  ) {
    this.propertyForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      street: ['', Validators.required],
      city: ['', Validators.required],
      postalCode: ['', Validators.required],
      country: ['', Validators.required],
      state: [''],
      latitude: [''],
      longitude: ['']
    });
  }

  ngOnInit() {
    this.loadProperties();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadProperties() {
    try {
      this.properties = await this.modelService.getPropertyGroups();
      this.filterProperties();
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  }

  filterProperties() {
    this.filteredProperties = this.properties.filter(property => {
      const matchesSearch = !this.searchTerm ||
        property.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        property.description?.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesLocation = !this.selectedLocation || property.address?.city === this.selectedLocation;

      return matchesSearch && matchesLocation;
    });
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedLocation = '';
    this.filterProperties();
  }

  editProperty(property: PropertyGroup) {
    this.editingProperty = property;
    this.propertyForm.patchValue({
      name: property.name,
      description: property.description,
      street: property.address?.street,
      city: property.address?.city,
      zipCode: property.address?.zipCode,
      country: property.address?.country,
      state: property.address?.state,
      latitude: property.address?.coordinates?.latitude,
      longitude: property.address?.coordinates?.longitude
    });
    this.showEditModal = true;
  }

  async togglePropertyStatus(property: PropertyGroup) {
    try {
      const newStatus = property.status === 'active' ? 'inactive' : 'active';
      await this.modelService.updatePropertyGroup(property.groupId, { status: newStatus });
      property.status = newStatus;
    } catch (error) {
      console.error('Error updating property status:', error);
    }
  }

  async deleteProperty(property: PropertyGroup) {
    if (confirm(`Are you sure you want to delete ${property.name}?`)) {
      try {
        await this.modelService.deletePropertyGroup(property.groupId);
        this.properties = this.properties.filter(p => p.groupId !== property.groupId);
        this.filterProperties();
      } catch (error) {
        console.error('Error deleting property:', error);
      }
    }
  }

  async saveProperty() {
    if (this.propertyForm.valid) {
      try {
        const formData = this.propertyForm.value;
        const propertyData: Partial<PropertyGroup> = {
          name: formData.name,
          description: formData.description,
          address: {
            street: formData.street || '',
            city: formData.city || '',
            zipCode: formData.zipCode || '',
            country: formData.country || '',
            state: formData.state || '',
            coordinates: {
              latitude: formData.latitude ? parseFloat(formData.latitude) : 0,
              longitude: formData.longitude ? parseFloat(formData.longitude) : 0
            }
          }
        };

        if (this.showCreateModal) {
          await this.modelService.createPropertyGroup(propertyData as PropertyGroup);
        } else if (this.editingProperty) {
          await this.modelService.updatePropertyGroup(this.editingProperty.groupId, propertyData);
        }

        this.closeModal();
        this.loadProperties();
      } catch (error) {
        console.error('Error saving property:', error);
      }
    }
  }

  closeModal() {
    this.showCreateModal = false;
    this.showEditModal = false;
    this.editingProperty = null;
    this.propertyForm.reset();
  }

  getTotalUnits(property: PropertyGroup): number {
    return property.buildingInfo?.totalUnits || 0;
  }

  getMinPrice(property: PropertyGroup): number {
    return property.priceRange?.min || 0;
  }

  getStatusBadgeClass(status: string): string {
    const classes = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      inactive: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      maintenance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    };
    return classes[status as keyof typeof classes] || classes.inactive;
  }
}
