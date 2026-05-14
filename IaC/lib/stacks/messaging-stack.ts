import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { SQS_QUEUES, SNS_TOPICS } from '../config/constants';

export interface MessagingStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class MessagingStack extends cdk.Stack {
  public readonly emailQueue: sqs.Queue;
  public readonly smsQueue: sqs.Queue;
  public readonly bookingEventsQueue: sqs.Queue;
  public readonly paymentEventsQueue: sqs.Queue;
  public readonly userEventsQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  
  public readonly bookingTopic: sns.Topic;
  public readonly paymentTopic: sns.Topic;
  public readonly userTopic: sns.Topic;
  public readonly systemAlertsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MessagingStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create Dead Letter Queue first
    this.deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `${config.appName}-${config.environment}-${SQS_QUEUES.DEAD_LETTER}`,
      retentionPeriod: cdk.Duration.days(14),
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create SQS Queues
    this.emailQueue = new sqs.Queue(this, 'EmailNotificationsQueue', {
      queueName: `${config.appName}-${config.environment}-${SQS_QUEUES.EMAIL_NOTIFICATIONS}`,
      visibilityTimeout: cdk.Duration.seconds(config.sqs.visibilityTimeoutSeconds),
      retentionPeriod: cdk.Duration.seconds(config.sqs.messageRetentionPeriodSeconds),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: config.sqs.maxReceiveCount,
      },
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.smsQueue = new sqs.Queue(this, 'SmsNotificationsQueue', {
      queueName: `${config.appName}-${config.environment}-${SQS_QUEUES.SMS_NOTIFICATIONS}`,
      visibilityTimeout: cdk.Duration.seconds(config.sqs.visibilityTimeoutSeconds),
      retentionPeriod: cdk.Duration.seconds(config.sqs.messageRetentionPeriodSeconds),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: config.sqs.maxReceiveCount,
      },
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.bookingEventsQueue = new sqs.Queue(this, 'BookingEventsQueue', {
      queueName: `${config.appName}-${config.environment}-${SQS_QUEUES.BOOKING_EVENTS}`,
      visibilityTimeout: cdk.Duration.seconds(config.sqs.visibilityTimeoutSeconds),
      retentionPeriod: cdk.Duration.seconds(config.sqs.messageRetentionPeriodSeconds),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: config.sqs.maxReceiveCount,
      },
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.paymentEventsQueue = new sqs.Queue(this, 'PaymentEventsQueue', {
      queueName: `${config.appName}-${config.environment}-${SQS_QUEUES.PAYMENT_EVENTS}`,
      visibilityTimeout: cdk.Duration.seconds(config.sqs.visibilityTimeoutSeconds),
      retentionPeriod: cdk.Duration.seconds(config.sqs.messageRetentionPeriodSeconds),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: config.sqs.maxReceiveCount,
      },
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.userEventsQueue = new sqs.Queue(this, 'UserEventsQueue', {
      queueName: `${config.appName}-${config.environment}-${SQS_QUEUES.USER_EVENTS}`,
      visibilityTimeout: cdk.Duration.seconds(config.sqs.visibilityTimeoutSeconds),
      retentionPeriod: cdk.Duration.seconds(config.sqs.messageRetentionPeriodSeconds),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: config.sqs.maxReceiveCount,
      },
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create SNS Topics
    this.bookingTopic = new sns.Topic(this, 'BookingNotificationsTopic', {
      topicName: `${config.appName}-${config.environment}-${SNS_TOPICS.BOOKING_NOTIFICATIONS}`,
      displayName: `${config.sns.displayName} - Booking Notifications`,
    });

    this.paymentTopic = new sns.Topic(this, 'PaymentNotificationsTopic', {
      topicName: `${config.appName}-${config.environment}-${SNS_TOPICS.PAYMENT_NOTIFICATIONS}`,
      displayName: `${config.sns.displayName} - Payment Notifications`,
    });

    this.userTopic = new sns.Topic(this, 'UserNotificationsTopic', {
      topicName: `${config.appName}-${config.environment}-${SNS_TOPICS.USER_NOTIFICATIONS}`,
      displayName: `${config.sns.displayName} - User Notifications`,
    });

    this.systemAlertsTopic = new sns.Topic(this, 'SystemAlertsTopic', {
      topicName: `${config.appName}-${config.environment}-${SNS_TOPICS.SYSTEM_ALERTS}`,
      displayName: `${config.sns.displayName} - System Alerts`,
    });

    // Apply removal policy to all topics
    this.bookingTopic.applyRemovalPolicy(config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY);
    this.paymentTopic.applyRemovalPolicy(config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY);
    this.userTopic.applyRemovalPolicy(config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY);
    this.systemAlertsTopic.applyRemovalPolicy(config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY);

    // Subscribe queues to topics
    this.bookingTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(this.bookingEventsQueue, {
        rawMessageDelivery: true,
      })
    );

    this.paymentTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(this.paymentEventsQueue, {
        rawMessageDelivery: true,
      })
    );

    this.userTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(this.userEventsQueue, {
        rawMessageDelivery: true,
      })
    );

    // Add email subscriptions for system alerts (you can add actual email addresses)
    // this.systemAlertsTopic.addSubscription(
    //   new snsSubscriptions.EmailSubscription('admin@harmonest.de')
    // );

    // Add tags to resources
    cdk.Tags.of(this.emailQueue).add('ResourceType', 'Queue');
    cdk.Tags.of(this.smsQueue).add('ResourceType', 'Queue');
    cdk.Tags.of(this.bookingEventsQueue).add('ResourceType', 'Queue');
    cdk.Tags.of(this.paymentEventsQueue).add('ResourceType', 'Queue');
    cdk.Tags.of(this.userEventsQueue).add('ResourceType', 'Queue');
    cdk.Tags.of(this.deadLetterQueue).add('ResourceType', 'Queue');
    
    cdk.Tags.of(this.bookingTopic).add('ResourceType', 'Topic');
    cdk.Tags.of(this.paymentTopic).add('ResourceType', 'Topic');
    cdk.Tags.of(this.userTopic).add('ResourceType', 'Topic');
    cdk.Tags.of(this.systemAlertsTopic).add('ResourceType', 'Topic');

    // Output important information
    new cdk.CfnOutput(this, 'EmailQueueUrl', {
      value: this.emailQueue.queueUrl,
      description: 'Email Notifications Queue URL',
    });

    new cdk.CfnOutput(this, 'SmsQueueUrl', {
      value: this.smsQueue.queueUrl,
      description: 'SMS Notifications Queue URL',
    });

    new cdk.CfnOutput(this, 'BookingTopicArn', {
      value: this.bookingTopic.topicArn,
      description: 'Booking Notifications Topic ARN',
    });

    new cdk.CfnOutput(this, 'PaymentTopicArn', {
      value: this.paymentTopic.topicArn,
      description: 'Payment Notifications Topic ARN',
    });
  }
}
