<template>
  <div>
    <v-row class="mb-4">
      <v-col>
        <h1 class="text-h4">Client Configurations</h1>
      </v-col>
      <v-col cols="auto">
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          Create New Client
        </v-btn>
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

    <v-progress-linear
      v-if="loading"
      indeterminate
      class="mb-4"
    ></v-progress-linear>

    <v-row v-if="clients.length === 0 && !loading">
      <v-col>
        <v-card>
          <v-card-text class="text-center">
            <v-icon size="64" color="grey-lighten-1" class="mb-4">
              mdi-folder-open-outline
            </v-icon>
            <h3 class="text-h6 mb-2">No clients configured</h3>
            <p class="text-body-2 text-medium-emphasis">
              Create your first client configuration to get started.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col
        v-for="client in clients"
        :key="client"
        cols="12"
        sm="6"
        md="4"
      >
        <v-card>
          <v-card-title>{{ client }}</v-card-title>
          <v-card-subtitle>
            Client configuration for {{ client }}
          </v-card-subtitle>
          <v-card-text>
            <v-chip
              color="success"
              size="small"
              prepend-icon="mdi-check-circle"
            >
              Active
            </v-chip>
          </v-card-text>
          <v-card-actions>
            <v-btn
              size="small"
              prepend-icon="mdi-eye"
              @click="viewClient(client)"
            >
              View
            </v-btn>
            <v-btn
              size="small"
              prepend-icon="mdi-pencil"
              @click="editClient(client)"
            >
              Edit
            </v-btn>
            <v-btn
              size="small"
              color="error"
              prepend-icon="mdi-delete"
              @click="confirmDelete(client)"
            >
              Delete
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create Client Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="500">
      <v-card>
        <v-card-title>Create New Client</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newClientName"
            label="Client Name"
            :error-messages="createError"
            hint="Lowercase letters, numbers, and hyphens only. Must start with a letter."
            persistent-hint
            @keyup.enter="createClient"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="cancelCreate">Cancel</v-btn>
          <v-btn
            color="primary"
            :loading="creating"
            @click="createClient"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="500">
      <v-card>
        <v-card-title>Delete Client Configuration</v-card-title>
        <v-card-text>
          Are you sure you want to delete the configuration for "{{ clientToDelete }}"?
          This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="cancelDelete">Cancel</v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            @click="deleteClient"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import configService from '@/services/configService'

export default {
  name: 'ClientList',
  data() {
    return {
      clients: [],
      loading: false,
      error: null,
      showCreateDialog: false,
      newClientName: '',
      createError: null,
      creating: false,
      showDeleteDialog: false,
      clientToDelete: null,
      deleting: false
    }
  },
  async mounted() {
    await this.loadClients()
  },
  methods: {
    async loadClients() {
      this.loading = true
      this.error = null
      try {
        this.clients = await configService.getClients()
      } catch (error) {
        this.error = `Failed to load clients: ${error.message}`
      } finally {
        this.loading = false
      }
    },
    viewClient(clientName) {
      this.$router.push(`/clients/${clientName}`)
    },
    editClient(clientName) {
      this.$router.push(`/clients/${clientName}/edit`)
    },
    confirmDelete(clientName) {
      this.clientToDelete = clientName
      this.showDeleteDialog = true
    },
    async deleteClient() {
      this.deleting = true
      try {
        await configService.deleteClient(this.clientToDelete)
        await this.loadClients()
        this.showDeleteDialog = false
        this.clientToDelete = null
      } catch (error) {
        this.error = `Failed to delete client: ${error.message}`
      } finally {
        this.deleting = false
      }
    },
    cancelDelete() {
      this.showDeleteDialog = false
      this.clientToDelete = null
    },
    async createClient() {
      this.createError = null

      if (!this.newClientName.trim()) {
        this.createError = 'Client name is required'
        return
      }

      if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(this.newClientName)) {
        this.createError = 'Client name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens'
        return
      }

      if (this.clients.includes(this.newClientName)) {
        this.createError = 'Client already exists'
        return
      }

      this.creating = true
      try {
        await configService.createClient(this.newClientName)
        await this.loadClients()
        this.showCreateDialog = false
        this.$router.push(`/clients/${this.newClientName}/edit`)
      } catch (error) {
        this.createError = error.message
      } finally {
        this.creating = false
      }
    },
    cancelCreate() {
      this.showCreateDialog = false
      this.newClientName = ''
      this.createError = null
    }
  }
}
</script>
