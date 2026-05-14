<template>
  <v-app>
    <v-app-bar
      app
      color="primary"
      dark
    >
      <v-app-bar-title>
        Client Configuration Manager
      </v-app-bar-title>
      
      <v-spacer></v-spacer>
      
      <v-btn
        icon="mdi-plus"
        @click="$router.push('/create')"
      >
      </v-btn>
    </v-app-bar>

    <v-navigation-drawer
      app
      permanent
      width="200"
    >
      <v-list>
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Clients"
          value="clients"
          @click="$router.push('/clients')"
        ></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid>
        <router-view />
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
export default {
  name: 'App',
  data: () => ({
    //
  }),
}
</script>
