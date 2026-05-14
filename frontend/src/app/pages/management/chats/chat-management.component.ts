import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ModelService } from '../../../services/model.service';
import * as feather from 'feather-icons';

interface Message {
  id: string;
  content: string;
  isFromHost: boolean;
  timestamp: Date;
}

interface Conversation {
  id: string;
  guestName: string;
  propertyName: string;
  lastMessage: string;
  lastMessageTime: Date;
  status: 'active' | 'resolved' | 'archived';
  unreadCount: number;
  messages: Message[];
}

@Component({
  selector: 'app-chat-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-management.component.html'
})
export class ChatManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  private destroy$ = new Subject<void>();

  showLearning = false;
  searchTerm = '';
  newMessage = '';

  // Data
  conversations: Conversation[] = [];
  filteredConversations: Conversation[] = [];
  selectedConversation: Conversation | null = null;

  // Stats
  stats = {
    totalMessages: 0,
    unreadMessages: 0,
    avgResponseTime: 0,
    activeChats: 0,
    onlineGuests: 0
  };

  constructor(
    private modelService: ModelService
  ) {}

  ngOnInit() {
    this.loadConversations();
    this.calculateStats();
  }

  ngAfterViewInit() {
    feather.replace();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadConversations() {
    // Mock data for now
    this.conversations = [
      {
        id: '1',
        guestName: 'John Smith',
        propertyName: 'Sunset Villa',
        lastMessage: 'Thank you for the quick response!',
        lastMessageTime: new Date(Date.now() - 30 * 60 * 1000),
        status: 'active',
        unreadCount: 2,
        messages: [
          {
            id: '1',
            content: 'Hi, I have a question about check-in time.',
            isFromHost: false,
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
          },
          {
            id: '2',
            content: 'Hello! Check-in is available from 3 PM onwards. Is there anything specific you need help with?',
            isFromHost: true,
            timestamp: new Date(Date.now() - 90 * 60 * 1000)
          },
          {
            id: '3',
            content: 'Perfect, that works for us. Can we get the WiFi password?',
            isFromHost: false,
            timestamp: new Date(Date.now() - 60 * 60 * 1000)
          },
          {
            id: '4',
            content: 'Of course! The WiFi password is "SunsetVilla2024". You\'ll also find this information in your welcome packet.',
            isFromHost: true,
            timestamp: new Date(Date.now() - 45 * 60 * 1000)
          },
          {
            id: '5',
            content: 'Thank you for the quick response!',
            isFromHost: false,
            timestamp: new Date(Date.now() - 30 * 60 * 1000)
          }
        ]
      },
      {
        id: '2',
        guestName: 'Sarah Johnson',
        propertyName: 'Ocean View Apartment',
        lastMessage: 'The heating system seems to be having issues.',
        lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'active',
        unreadCount: 1,
        messages: [
          {
            id: '1',
            content: 'Hello, we just checked in and everything looks great!',
            isFromHost: false,
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000)
          },
          {
            id: '2',
            content: 'Wonderful! Welcome to Ocean View Apartment. Please let me know if you need anything during your stay.',
            isFromHost: true,
            timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000)
          },
          {
            id: '3',
            content: 'The heating system seems to be having issues.',
            isFromHost: false,
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
          }
        ]
      },
      {
        id: '3',
        guestName: 'Mike Wilson',
        propertyName: 'Mountain Cabin',
        lastMessage: 'Great, see you then!',
        lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: 'resolved',
        unreadCount: 0,
        messages: [
          {
            id: '1',
            content: 'Hi, we\'re running about 30 minutes late for check-in. Is that okay?',
            isFromHost: false,
            timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000)
          },
          {
            id: '2',
            content: 'No problem at all! I\'ll be available until 8 PM. Just let me know when you arrive.',
            isFromHost: true,
            timestamp: new Date(Date.now() - 24.5 * 60 * 60 * 1000)
          },
          {
            id: '3',
            content: 'Great, see you then!',
            isFromHost: false,
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        ]
      }
    ];

    this.filteredConversations = [...this.conversations];
    this.calculateStats();
  }

  calculateStats() {
    this.stats.totalMessages = this.conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    this.stats.unreadMessages = this.conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
    this.stats.activeChats = this.conversations.filter(conv => conv.status === 'active').length;
    this.stats.avgResponseTime = 15; // Mock average response time in minutes
    this.stats.onlineGuests = 3; // Mock online guests count
  }

  filterConversations() {
    if (!this.searchTerm.trim()) {
      this.filteredConversations = [...this.conversations];
    } else {
      this.filteredConversations = this.conversations.filter(conv =>
        conv.guestName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        conv.propertyName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        conv.lastMessage.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  selectConversation(conversation: Conversation) {
    this.selectedConversation = conversation;
    // Mark as read
    conversation.unreadCount = 0;
    this.calculateStats();

    // Scroll to bottom of messages after view update
    setTimeout(() => this.scrollToBottom(), 100);
  }

  getConversationStatusClass(status: string): string {
    const classes = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      resolved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      archived: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return classes[status as keyof typeof classes] || classes.active;
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedConversation) return;

    const message: Message = {
      id: Date.now().toString(),
      content: this.newMessage.trim(),
      isFromHost: true,
      timestamp: new Date()
    };

    this.selectedConversation.messages.push(message);
    this.selectedConversation.lastMessage = this.newMessage.trim();
    this.selectedConversation.lastMessageTime = new Date();

    this.newMessage = '';
    this.calculateStats();

    // Scroll to bottom after sending message
    setTimeout(() => this.scrollToBottom(), 100);
  }

  markAsResolved(conversation: Conversation) {
    conversation.status = 'resolved';
    this.calculateStats();
  }

  archiveConversation(conversation: Conversation) {
    conversation.status = 'archived';
    this.calculateStats();
  }

  startNewConversation() {
    console.log('Start new conversation');
    // Implement new conversation logic
  }

  createTemplate() {
    console.log('Create message template');
    // Implement template creation
  }

  exportConversations() {
    console.log('Export conversations');
    // Implement export functionality
  }

  configureAutoResponses() {
    console.log('Configure auto responses');
    // Implement auto response configuration
  }

  viewAnalytics() {
    console.log('View analytics');
    // Implement analytics viewing
  }

  trackByConversationId(index: number, conversation: Conversation): string {
    return conversation.id;
  }

  private scrollToBottom() {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }
}
