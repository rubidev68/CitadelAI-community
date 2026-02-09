import prisma from '../lib/prisma';
import { isFeatureEnabled, getFeatureFlags } from '../shared/config/features';
import { adminLogger } from '../app';

/**
 * Helper function to create/update default subscription plans (only if billing is enabled)
 */
export const createDefaultPlans = async () => {
  if (!isFeatureEnabled('billing')) {
    adminLogger.info('Skipping subscription plan creation (billing disabled)');
    return;
  }

  // Always update plans to match business-website (upsert)
  adminLogger.info('Ensuring plans match business-website');
  
  // FIRST: Fix "Starter plan" -> "Starter" if it exists
  const starterPlanWithSuffix = await prisma.subscriptionPlan.findFirst({
    where: {
      OR: [
        { name: 'Starter plan' },
        { name: 'Starter Plan' }
      ]
    }
  });

  if (starterPlanWithSuffix) {
    const existingStarter = await prisma.subscriptionPlan.findUnique({
      where: { name: 'Starter' }
    });
    if (!existingStarter) {
      // Rename it
      await prisma.subscriptionPlan.update({
        where: { id: starterPlanWithSuffix.id },
        data: { name: 'Starter' }
      });
      adminLogger.info('Renamed "Starter plan" to "Starter"');
    } else {
      // Delete duplicate
      await prisma.subscriptionPlan.delete({
        where: { id: starterPlanWithSuffix.id }
      });
      adminLogger.info('Removed duplicate "Starter plan"');
    }
  }
  
  // Update or create Starter plan
  await prisma.subscriptionPlan.upsert({
    where: { name: 'Starter' },
    update: {
      description: 'Perfect for small businesses and startups',
      price: 29.00,
      maxChatbots: 1,
      features: {
        messagesPerMonth: 1000,
        pagesIndexed: 500,
        emailSupport: true,
        webIntegration: true,
        euDataResidency: true
      }
    },
    create: {
      name: 'Starter',
      description: 'Perfect for small businesses and startups',
      price: 29.00,
      currency: 'USD',
      interval: 'month',
      maxChatbots: 1,
      features: {
        messagesPerMonth: 1000,
        pagesIndexed: 500,
        emailSupport: true,
        webIntegration: true,
        euDataResidency: true
      },
      isActive: true,
    },
  });
  adminLogger.info('Starter plan updated');

  // Update or create Pro plan
  await prisma.subscriptionPlan.upsert({
    where: { name: 'Pro' },
    update: {
      description: 'Ideal for growing teams and businesses',
      price: 49.00,
      maxChatbots: 5,
      features: {
        messagesPerMonth: 10000,
        pagesIndexed: 5000,
        prioritySupport: true,
        proAiModels: true,
        teamsSlackIntegration: true,
        apiAccess: true,
        euDataResidency: true
      }
    },
    create: {
      name: 'Pro',
      description: 'Ideal for growing teams and businesses',
      price: 49.00,
      currency: 'USD',
      interval: 'month',
      maxChatbots: 5,
      features: {
        messagesPerMonth: 10000,
        pagesIndexed: 5000,
        prioritySupport: true,
        proAiModels: true,
        teamsSlackIntegration: true,
        apiAccess: true,
        euDataResidency: true
      },
      isActive: true,
    },
  });
  adminLogger.info('Pro plan updated');

  // Update Enterprise plan
  await prisma.subscriptionPlan.upsert({
    where: { name: 'Enterprise' },
    update: {
      description: 'For large organizations with advanced needs',
      features: {
        unlimitedChatbots: true,
        unlimitedMessages: true,
        unlimitedPagesIndexed: true,
        dedicatedSupport: true,
        customIntegrations: true,
        euDataResidency: true,
        slaGuarantee: true,
        dedicatedInstance: true,
        whiteLabelOptions: true
      }
    },
    create: {
      name: 'Enterprise',
      description: 'For large organizations with advanced needs',
      price: 0,
      currency: 'USD',
      interval: 'month',
      maxChatbots: null,
      features: {
        unlimitedChatbots: true,
        unlimitedMessages: true,
        unlimitedPagesIndexed: true,
        dedicatedSupport: true,
        customIntegrations: true,
        euDataResidency: true,
        slaGuarantee: true,
        dedicatedInstance: true,
        whiteLabelOptions: true
      },
      isActive: true,
    },
  });
  adminLogger.info('Enterprise plan updated');
};
