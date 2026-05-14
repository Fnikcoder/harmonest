<template>
  <div>
    <v-row class="mb-4">
      <v-col>
        <h1 class="text-h4">
          {{ isCreateMode ? 'Create New Client' : `Client: ${config?.client?.displayName || config?.client?.name}` }}
        </h1>
      </v-col>
      <v-col cols="auto">
        <v-btn-group v-if="!isEditing && !isCreateMode">
          <v-btn
            prepend-icon="mdi-pencil"
            @click="startEditing"
          >
            Edit
          </v-btn>
          <v-btn
            prepend-icon="mdi-arrow-left"
            @click="$router.push('/clients')"
          >
            Back to List
          </v-btn>
        </v-btn-group>
        <v-btn-group v-else>
          <v-btn
            color="primary"
            prepend-icon="mdi-content-save"
            :loading="saving"
            @click="saveConfig"
          >
            Save
          </v-btn>
          <v-btn
            prepend-icon="mdi-cancel"
            @click="cancelEditing"
          >
            Cancel
          </v-btn>
        </v-btn-group>
      </v-col>
    </v-row>

    <v-alert
      v-if="error"
      type="error"
      class="mb-4"
      closable
      @click:close="error = null"
    >
      {{ error }}
    </v-alert>

    <v-alert
      v-if="validationError"
      type="warning"
      class="mb-4"
      closable
      @click:close="validationError = null"
    >
      {{ validationError }}
    </v-alert>

    <v-progress-linear
      v-if="loading"
      indeterminate
      class="mb-4"
    ></v-progress-linear>

    <v-card v-if="config">
      <v-tabs v-model="currentTab">
        <v-tab value="basic">Basic Info</v-tab>
        <v-tab value="domains">Domains</v-tab>
        <v-tab value="email">Email</v-tab>
        <v-tab value="aws">AWS</v-tab>
        <v-tab value="features">Features</v-tab>
        <v-tab value="environments">Environments</v-tab>
      </v-tabs>

      <v-card-text>
        <v-window v-model="currentTab">
          <!-- Basic Info Tab -->
          <v-window-item value="basic">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.name"
                  label="Client Name"
                  :disabled="!isEditing || !isCreateMode"
                  :hint="isCreateMode ? 'Lowercase letters, numbers, and hyphens only' : 'Cannot be changed after creation'"
                  persistent-hint
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.displayName"
                  label="Display Name"
                  :disabled="!isEditing"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="config.client.description"
                  label="Description"
                  :disabled="!isEditing"
                  rows="3"
                ></v-textarea>
              </v-col>
            </v-row>
          </v-window-item>

          <!-- Domains Tab -->
          <v-window-item value="domains">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.domains.primary"
                  label="Primary Domain"
                  :disabled="!isEditing"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.domains.www"
                  label="WWW Domain"
                  :disabled="!isEditing"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.domains.dev"
                  label="Development Domain"
                  :disabled="!isEditing"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.domains.staging"
                  label="Staging Domain"
                  :disabled="!isEditing"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.domains.api"
                  label="API Domain"
                  :disabled="!isEditing"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.domains.admin"
                  label="Admin Domain"
                  :disabled="!isEditing"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-window-item>

          <!-- Email Tab -->
          <v-window-item value="email">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.email.noreply"
                  label="No-Reply Email"
                  :disabled="!isEditing"
                  type="email"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.email.support"
                  label="Support Email"
                  :disabled="!isEditing"
                  type="email"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.email.admin"
                  label="Admin Email"
                  :disabled="!isEditing"
                  type="email"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.email.notifications"
                  label="Notifications Email"
                  :disabled="!isEditing"
                  type="email"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.email.fromName"
                  label="From Name"
                  :disabled="!isEditing"
                  hint="Display name for outgoing emails"
                  persistent-hint
                ></v-text-field>
              </v-col>
            </v-row>
          </v-window-item>

          <!-- AWS Tab -->
          <v-window-item value="aws">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.aws.profile"
                  label="AWS Profile"
                  :disabled="!isEditing"
                  hint="AWS CLI profile name"
                  persistent-hint
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.aws.region"
                  label="AWS Region"
                  :disabled="!isEditing"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.aws.accountId"
                  label="AWS Account ID"
                  :disabled="!isEditing"
                  hint="12-digit AWS account ID"
                  persistent-hint
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="config.client.aws.kmsKeyId"
                  label="KMS Key ID"
                  :disabled="!isEditing"
                  hint="KMS key for encryption"
                  persistent-hint
                ></v-text-field>
              </v-col>
            </v-row>
          </v-window-item>

          <!-- Features Tab -->
          <v-window-item value="features">
            <div class="mb-6">
              <h3 class="text-h6 mb-4">Check-in Features</h3>
              <v-row>
                <v-col cols="12" md="6">
                  <v-switch
                    v-model="checkinEnabled"
                    label="Enable Check-in"
                    :disabled="!isEditing"
                  ></v-switch>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="checkinDeadlineHours"
                    label="Deadline Hours"
                    type="number"
                    :disabled="!isEditing"
                    hint="Hours before check-in when updates are no longer allowed"
                    persistent-hint
                  ></v-text-field>
                </v-col>
              </v-row>
            </div>
          </v-window-item>

          <!-- Environments Tab -->
          <v-window-item value="environments">
            <h3 class="text-h6 mb-4">Environment Configurations</h3>
            <p class="text-body-2 text-medium-emphasis mb-4">
              Configure environment-specific settings that override the base client configuration.
            </p>
            
            <div v-for="(envConfig, envName) in config.environments" :key="envName" class="mb-6">
              <h4 class="text-h6 mb-2">{{ envName.toUpperCase() }} Environment</h4>
              <v-row>
                <v-col cols="12" md="6">
                  <v-switch
                    v-model="envConfig.enabled"
                    label="Environment Enabled"
                    :disabled="!isEditing"
                  ></v-switch>
                </v-col>
              </v-row>
            </div>
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </div>
</template>

<script>
import configService from '@/services/configService'

export default {
  name: 'ClientEditor',
  props: {
    clientName: String,
    isEditing: {
      type: Boolean,
      default: false
    },
    isCreateMode: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      config: null,
      originalConfig: null,
      loading: false,
      saving: false,
      error: null,
      validationError: null,
      currentTab: 'basic'
    }
  },
  computed: {
    checkinEnabled: {
      get() {
        return this.config?.client?.features?.checkin?.enabled ?? true
      },
      set(value) {
        this.ensureFeatureStructure()
        this.config.client.features.checkin.enabled = value
      }
    },
    checkinDeadlineHours: {
      get() {
        return this.config?.client?.features?.checkin?.deadlineHours ?? 25
      },
      set(value) {
        this.ensureFeatureStructure()
        this.config.client.features.checkin.deadlineHours = value
      }
    }
  },
  async mounted() {
    if (this.isCreateMode) {
      this.initializeEmptyConfig()
    } else if (this.clientName) {
      await this.loadClient()
    }
  },
  methods: {
    initializeEmptyConfig() {
      this.config = {
        client: {
          name: '',
          displayName: '',
          domains: {
            primary: ''
          },
          email: {
            noreply: ''
          },
          aws: {
            profile: '',
            region: 'eu-central-1'
          }
        },
        environments: {
          prod: {
            enabled: true
          }
        }
      }
    },
    async loadClient() {
      this.loading = true
      this.error = null
      try {
        this.config = await configService.getClient(this.clientName)
        this.originalConfig = JSON.parse(JSON.stringify(this.config))
      } catch (error) {
        this.error = `Failed to load client: ${error.message}`
      } finally {
        this.loading = false
      }
    },
    startEditing() {
      this.$router.push(`/clients/${this.clientName}/edit`)
    },
    cancelEditing() {
      if (this.isCreateMode) {
        this.$router.push('/clients')
      } else {
        this.config = JSON.parse(JSON.stringify(this.originalConfig))
        this.$router.push(`/clients/${this.clientName}`)
      }
    },
    async saveConfig() {
      this.saving = true
      this.error = null
      this.validationError = null

      try {
        // Validate configuration
        const validation = await configService.validateConfig(this.config)
        if (!validation.valid) {
          this.validationError = validation.message
          return
        }

        const clientNameToSave = this.isCreateMode ? this.config.client.name : this.clientName
        await configService.updateClient(clientNameToSave, this.config)

        if (this.isCreateMode) {
          this.$router.push(`/clients/${clientNameToSave}`)
        } else {
          this.$router.push(`/clients/${this.clientName}`)
        }
      } catch (error) {
        this.error = error.message
      } finally {
        this.saving = false
      }
    },
    ensureFeatureStructure() {
      if (!this.config.client.features) {
        this.config.client.features = {}
      }
      if (!this.config.client.features.checkin) {
        this.config.client.features.checkin = {}
      }
    }
  }
}
</script>
