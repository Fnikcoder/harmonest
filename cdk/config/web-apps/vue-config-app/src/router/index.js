import { createRouter, createWebHistory } from 'vue-router'
import ClientList from '../views/ClientList.vue'
import ClientEditor from '../views/ClientEditor.vue'

const routes = [
  {
    path: '/',
    redirect: '/clients'
  },
  {
    path: '/clients',
    name: 'ClientList',
    component: ClientList
  },
  {
    path: '/clients/:clientName',
    name: 'ClientView',
    component: ClientEditor,
    props: true
  },
  {
    path: '/clients/:clientName/edit',
    name: 'ClientEdit',
    component: ClientEditor,
    props: route => ({ ...route.params, isEditing: true })
  },
  {
    path: '/create',
    name: 'ClientCreate',
    component: ClientEditor,
    props: { isCreateMode: true }
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
