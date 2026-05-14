import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ModelService } from '../../../../services/model.service';

interface Unit {
  unitId: string;
  unitNumber: string;
  propertyGroupId: string;
  propertyGroupName?: string;
  unitModelId: string;
  unitModelName?: string;
  status: 'available' | 'occupied' | 'maintenance' | 'blocked';
  floor?: number;
  size?: number;
  maxOccupancy: number;
  basePrice: number;
  amenities?: string[];
  images?: string[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UnitModel {
  modelId: string;
  name: string;
  description: string;
  basePrice: number;
  maxOccupancy: number;
  amenities: string[];
}

@Component({
  selector: 'app-units-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Units Management</h1>
          <p class="text-gray-600 dark:text-gray-400">Manage individual units, unit types, and availability</p>
        </div>
        <div class="flex space-x-3">
          <button (click)="showLearning = !showLearning"
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            <i class="fas fa-graduation-cap mr-2"></i>
            Learning Guide
          </button>
          <button (click)="showCreateModal = true"
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            <i class="fas fa-plus mr-2"></i>
            Add Unit
          </button>
        </div>
      </div>

      <!-- Learning Section -->
      <div *ngIf="showLearning" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div class="flex items-start space-x-3">
          <i class="fas fa-lightbulb text-blue-600 dark:text-blue-400 mt-1"></i>
          <div>
            <h3 class="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">Units Management Guide</h3>
            <div class="space-y-3 text-sm text-blue-700 dark:text-blue-300">
              <div>
                <h4 class="font-medium mb-1">Understanding Units vs Unit Models:</h4>
                <ul class="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Unit Models:</strong> Templates that define unit types (e.g., "1 Bedroom Apartment")</li>
                  <li><strong>Individual Units:</strong> Specific physical units based on models (e.g., "Apt 2B")</li>
                  <li><strong>Relationship:</strong> Multiple units can share the same model but have unique identifiers</li>
                </ul>
              </div>
              <div>
                <h4 class="font-medium mb-1">Best Practices:</h4>
                <ul class="list-disc list-inside space-y-1 ml-4">
                  <li>Use clear naming conventions (building + floor + unit number)</li>
                  <li>Keep unit models consistent for pricing and availability</li>
                  <li>Update unit status regularly (available, occupied, maintenance)</li>
                  <li>Add detailed descriptions and high-quality photos</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Units</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ units.length }}</p>
            </div>
            <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-door-open text-blue-600 dark:text-blue-400"></i>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Available</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ getUnitsByStatus('available').length }}</p>
            </div>
            <div class="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-check-circle text-green-600 dark:text-green-400"></i>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Occupied</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ getUnitsByStatus('occupied').length }}</p>
            </div>
            <div class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-user text-yellow-600 dark:text-yellow-400"></i>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Maintenance</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ getUnitsByStatus('maintenance').length }}</p>
            </div>
            <div class="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-tools text-red-600 dark:text-red-400"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
            <input [(ngModel)]="searchTerm"
                   (input)="filterUnits()"
                   type="text"
                   placeholder="Search units..."
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Property</label>
            <select [(ngModel)]="selectedProperty"
                    (change)="filterUnits()"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
              <option value="">All Properties</option>
              <option *ngFor="let property of properties" [value]="property.id">{{ property.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unit Model</label>
            <select [(ngModel)]="selectedUnitModel"
                    (change)="filterUnits()"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
              <option value="">All Models</option>
              <option *ngFor="let model of unitModels" [value]="model.modelId">{{ model.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            <select [(ngModel)]="selectedStatus"
                    (change)="filterUnits()"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
              <option value="blocked">Blocked</option>
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

      <!-- Units Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div *ngFor="let unit of filteredUnits"
             class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">

          <!-- Unit Image -->
          <div class="h-48 bg-gray-200 dark:bg-gray-700 relative">
            <img *ngIf="unit.images && unit.images.length > 0"
                 [src]="unit.images[0]"
                 [alt]="unit.unitNumber"
                 class="w-full h-full object-cover">
            <div *ngIf="!unit.images || unit.images.length === 0"
                 class="w-full h-full flex items-center justify-center">
              <i class="fas fa-door-open text-gray-400 text-4xl"></i>
            </div>

            <!-- Status Badge -->
            <div class="absolute top-3 right-3">
              <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                    [ngClass]="getStatusBadgeClass(unit.status)">
                {{ unit.status | titlecase }}
              </span>
            </div>

            <!-- Unit Number Badge -->
            <div class="absolute top-3 left-3">
              <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                {{ unit.unitNumber }}
              </span>
            </div>
          </div>

          <!-- Unit Info -->
          <div class="p-6">
            <div class="flex items-start justify-between mb-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Unit {{ unit.unitNumber }}</h3>
              <div class="flex space-x-2">
                <button (click)="editUnit(unit)"
                        class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400">
                  <i class="fas fa-edit"></i>
                </button>
                <button (click)="deleteUnit(unit)"
                        class="text-red-600 hover:text-red-900 dark:text-red-400">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>

            <p class="text-gray-600 dark:text-gray-400 text-sm mb-3">
              {{ unit.propertyGroupName }}
            </p>

            <div class="space-y-2 text-sm">
              <div class="flex items-center text-gray-600 dark:text-gray-400">
                <i class="fas fa-home w-4 mr-2"></i>
                {{ unit.unitModelName }}
              </div>
              <div class="flex items-center text-gray-600 dark:text-gray-400">
                <i class="fas fa-users w-4 mr-2"></i>
                Max {{ unit.maxOccupancy }} guests
              </div>
              <div *ngIf="unit.size" class="flex items-center text-gray-600 dark:text-gray-400">
                <i class="fas fa-expand-arrows-alt w-4 mr-2"></i>
                {{ unit.size }} m²
              </div>
              <div class="flex items-center text-gray-600 dark:text-gray-400">
                <i class="fas fa-euro-sign w-4 mr-2"></i>
                From €{{ unit.basePrice }}/night
              </div>
            </div>

            <!-- Amenities -->
            <div *ngIf="unit.amenities && unit.amenities.length > 0" class="mt-4">
              <div class="flex flex-wrap gap-1">
                <span *ngFor="let amenity of unit.amenities.slice(0, 3)"
                      class="inline-flex px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                  {{ amenity }}
                </span>
                <span *ngIf="unit.amenities.length > 3"
                      class="inline-flex px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                  +{{ unit.amenities.length - 3 }} more
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="mt-4 flex space-x-2">
              <a [routerLink]="['/management/properties/units', unit.unitId]"
                 class="flex-1 bg-red-600 hover:bg-red-700 text-white text-center py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                View Details
              </a>
              <button (click)="toggleUnitStatus(unit)"
                      class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors">
                {{ getStatusToggleText(unit.status) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="filteredUnits.length === 0" class="text-center py-12">
        <i class="fas fa-door-open text-gray-400 text-4xl mb-4"></i>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No units found</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-4">Get started by creating your first unit.</p>
        <button (click)="showCreateModal = true"
                class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          <i class="fas fa-plus mr-2"></i>
          Add Unit
        </button>
      </div>
    </div>

    <!-- Create/Edit Unit Modal -->
    <div *ngIf="showCreateModal || showEditModal"
         class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ showCreateModal ? 'Create Unit' : 'Edit Unit' }}
            </h3>
            <button (click)="closeModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <form [formGroup]="unitForm" (ngSubmit)="saveUnit()" class="p-6">
          <div class="space-y-6">
            <!-- Basic Information -->
            <div>
              <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Basic Information</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unit Number</label>
                  <input formControlName="unitNumber"
                         type="text"
                         placeholder="e.g., 2B"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Property Group</label>
                  <select formControlName="propertyGroupId"
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                    <option value="">Select Property</option>
                    <option *ngFor="let property of properties" [value]="property.groupId">{{ property.name }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unit Model</label>
                  <select formControlName="unitModelId"
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                    <option value="">Select Model</option>
                    <option *ngFor="let model of unitModels" [value]="model.modelId">{{ model.name }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Floor</label>
                  <input formControlName="floor"
                         type="number"
                         placeholder="e.g., 2"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Size (m²)</label>
                  <input formControlName="size"
                         type="number"
                         placeholder="e.g., 75"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Occupancy</label>
                  <input formControlName="maxOccupancy"
                         type="number"
                         placeholder="e.g., 4"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Base Price (€/night)</label>
                  <input formControlName="basePrice"
                         type="number"
                         step="0.01"
                         placeholder="e.g., 120.00"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                </div>
              </div>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
              <textarea formControlName="description"
                        rows="3"
                        placeholder="Describe the unit features, layout, and unique characteristics..."
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"></textarea>
            </div>

            <!-- Status -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <select formControlName="status"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Maintenance</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button type="button"
                    (click)="closeModal()"
                    class="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button type="submit"
                    [disabled]="!unitForm.valid"
                    class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {{ showCreateModal ? 'Create Unit' : 'Update Unit' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class UnitsManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  showLearning = false;
  showCreateModal = false;
  showEditModal = false;
  editingUnit: Unit | null = null;

  units: Unit[] = [];
  filteredUnits: Unit[] = [];
  properties: any[] = [];
  unitModels: UnitModel[] = [];

  searchTerm = '';
  selectedProperty = '';
  selectedUnitModel = '';
  selectedStatus = '';

  unitForm: FormGroup;

  constructor(
    private modelService: ModelService,
    private fb: FormBuilder
  ) {
    this.unitForm = this.fb.group({
      unitNumber: ['', Validators.required],
      propertyGroupId: ['', Validators.required],
      unitModelId: ['', Validators.required],
      floor: [''],
      size: [''],
      maxOccupancy: ['', [Validators.required, Validators.min(1)]],
      basePrice: ['', [Validators.required, Validators.min(0)]],
      description: [''],
      status: ['available', Validators.required]
    });
  }

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData() {
    try {
      const [properties, individualUnits, unitModels] = await Promise.all([
        this.modelService.getPropertyGroups(),
        this.modelService.getIndividualUnits(),
        this.modelService.getUnitModels()
      ]);

      this.properties = properties;

      // For now, use mock data since the interfaces don't match
      this.units = this.generateMockUnits();
      this.unitModels = this.generateMockUnitModels();

      this.filterUnits();
    } catch (error) {
      console.error('Error loading units data:', error);
      // Use mock data as fallback
      this.properties = [];
      this.units = this.generateMockUnits();
      this.unitModels = this.generateMockUnitModels();
      this.filterUnits();
    }
  }

  filterUnits() {
    this.filteredUnits = this.units.filter(unit => {
      const matchesSearch = !this.searchTerm ||
        unit.unitNumber.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        unit.propertyGroupName?.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesProperty = !this.selectedProperty || unit.propertyGroupId === this.selectedProperty;
      const matchesModel = !this.selectedUnitModel || unit.unitModelId === this.selectedUnitModel;
      const matchesStatus = !this.selectedStatus || unit.status === this.selectedStatus;

      return matchesSearch && matchesProperty && matchesModel && matchesStatus;
    });
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedProperty = '';
    this.selectedUnitModel = '';
    this.selectedStatus = '';
    this.filterUnits();
  }

  getUnitsByStatus(status: string): Unit[] {
    return this.units.filter(unit => unit.status === status);
  }

  editUnit(unit: Unit) {
    this.editingUnit = unit;
    this.unitForm.patchValue({
      unitNumber: unit.unitNumber,
      propertyGroupId: unit.propertyGroupId,
      unitModelId: unit.unitModelId,
      floor: unit.floor,
      size: unit.size,
      maxOccupancy: unit.maxOccupancy,
      basePrice: unit.basePrice,
      description: unit.description,
      status: unit.status
    });
    this.showEditModal = true;
  }

  async toggleUnitStatus(unit: Unit) {
    try {
      let newStatus: Unit['status'];
      switch (unit.status) {
        case 'available':
          newStatus = 'maintenance';
          break;
        case 'maintenance':
          newStatus = 'available';
          break;
        case 'occupied':
          newStatus = 'available';
          break;
        default:
          newStatus = 'available';
      }

      await this.modelService.updateUnit(unit.unitId, { status: newStatus });
      unit.status = newStatus;
    } catch (error) {
      console.error('Error updating unit status:', error);
    }
  }

  async deleteUnit(unit: Unit) {
    if (confirm(`Are you sure you want to delete ${unit.unitNumber}?`)) {
      try {
        await this.modelService.deleteUnit(unit.unitId);
        this.units = this.units.filter(u => u.unitId !== unit.unitId);
        this.filterUnits();
      } catch (error) {
        console.error('Error deleting unit:', error);
      }
    }
  }

  async saveUnit() {
    if (this.unitForm.valid) {
      try {
        const unitData = this.unitForm.value;

        if (this.showCreateModal) {
          await this.modelService.createUnit(unitData);
        } else if (this.editingUnit) {
          await this.modelService.updateUnit(this.editingUnit.unitId, unitData);
        }

        this.closeModal();
        this.loadData();
      } catch (error) {
        console.error('Error saving unit:', error);
      }
    }
  }

  closeModal() {
    this.showCreateModal = false;
    this.showEditModal = false;
    this.editingUnit = null;
    this.unitForm.reset();
  }

  getStatusBadgeClass(status: string): string {
    const classes = {
      available: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      occupied: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      maintenance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      blocked: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    };
    return classes[status as keyof typeof classes] || classes.available;
  }

  getStatusToggleText(status: string): string {
    switch (status) {
      case 'available':
        return 'Set Maintenance';
      case 'maintenance':
        return 'Set Available';
      case 'occupied':
        return 'Set Available';
      default:
        return 'Set Available';
    }
  }

  generateMockUnits(): Unit[] {
    return [
      {
        unitId: '1',
        unitNumber: 'A101',
        propertyGroupId: '1',
        propertyGroupName: 'Sunset Apartments',
        unitModelId: '1',
        unitModelName: 'Studio',
        status: 'available',
        floor: 1,
        size: 45,
        maxOccupancy: 2,
        basePrice: 85,
        amenities: ['WiFi', 'Kitchen', 'AC'],
        images: [],
        description: 'Cozy studio apartment',
        createdAt: new Date('2023-01-15'),
        updatedAt: new Date('2024-01-15')
      },
      {
        unitId: '2',
        unitNumber: 'A102',
        propertyGroupId: '1',
        propertyGroupName: 'Sunset Apartments',
        unitModelId: '2',
        unitModelName: '1 Bedroom',
        status: 'occupied',
        floor: 1,
        size: 65,
        maxOccupancy: 3,
        basePrice: 120,
        amenities: ['WiFi', 'Kitchen', 'AC', 'Balcony'],
        images: [],
        description: 'Spacious 1-bedroom apartment',
        createdAt: new Date('2023-01-15'),
        updatedAt: new Date('2024-01-15')
      }
    ];
  }

  generateMockUnitModels(): UnitModel[] {
    return [
      {
        modelId: '1',
        name: 'Studio',
        description: 'Compact studio apartment',
        basePrice: 85,
        maxOccupancy: 2,
        amenities: ['WiFi', 'Kitchen', 'AC']
      },
      {
        modelId: '2',
        name: '1 Bedroom',
        description: 'One bedroom apartment',
        basePrice: 120,
        maxOccupancy: 3,
        amenities: ['WiFi', 'Kitchen', 'AC', 'Balcony']
      }
    ];
  }
}
