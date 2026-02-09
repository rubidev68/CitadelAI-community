import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

const updatePlansLogger = logger.child({ service: 'admin-backend', component: 'updatePlans-script' });

/**
 * Update existing subscription plans to match business-website pricing and features
 * This script updates plans if they exist, or creates them if they don't
 */
async function updatePlans() {
  updatePlansLogger.info('Updating subscription plans to match business-website');

  try {
    // Update or create Starter plan
    const starterPlan = await prisma.subscriptionPlan.upsert({
      where: { name: 'Starter' },
      update: {
        description: 'Perfect for small businesses and startups',
        price: 29.00,
        maxChatbots: 1,
        maxUsers: null,
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
        maxUsers: null,
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
    updatePlansLogger.info('Starter plan updated', { planId: starterPlan.id });

    // Update or create Professional plan (handle both "Pro" and "Professional")
    // First, check if "Pro" exists and update it to "Professional"
    const existingPro = await prisma.subscriptionPlan.findUnique({
      where: { name: 'Pro' }
    });

    if (existingPro && existingPro.name === 'Pro') {
      // Update Pro to Professional
      await prisma.subscriptionPlan.update({
        where: { name: 'Pro' },
        data: {
          name: 'Professional',
          description: 'Ideal for growing teams and businesses',
          price: 49.00,
          maxChatbots: 5,
          maxUsers: null,
          features: {
            messagesPerMonth: 10000,
            pagesIndexed: 5000,
            prioritySupport: true,
            proAiModels: true,
            teamsSlackIntegration: true,
            apiAccess: true,
            euDataResidency: true
          }
        }
      });
      updatePlansLogger.info('Pro plan renamed to Professional and updated');
    } else {
      // Create or update Professional plan
      const professionalPlan = await prisma.subscriptionPlan.upsert({
        where: { name: 'Professional' },
        update: {
          description: 'Ideal for growing teams and businesses',
          price: 49.00,
          maxChatbots: 5,
          maxUsers: null,
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
          name: 'Professional',
          description: 'Ideal for growing teams and businesses',
          price: 49.00,
          currency: 'USD',
          interval: 'month',
          maxChatbots: 5,
          maxUsers: null,
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
      updatePlansLogger.info('Professional plan updated', { planId: professionalPlan.id });
    }

    // Ensure Enterprise plan exists with correct features from business-website
    const enterprisePlan = await prisma.subscriptionPlan.upsert({
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
        maxUsers: null,
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
    updatePlansLogger.info('Enterprise plan ensured', { planId: enterprisePlan.id });

    // Check for and fix "Starter plan" (with "plan" in name) - rename to "Starter"
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
        try {
          await prisma.subscriptionPlan.update({
            where: { id: starterPlanWithSuffix.id },
            data: { name: 'Starter' }
          });
          updatePlansLogger.info('Renamed "Starter plan" to "Starter"');
        } catch (error: unknown) {
          updatePlansLogger.error('Error renaming Starter plan', { error: error instanceof Error ? error : new Error(String(error)) });
        }
      } else {
        try {
          await prisma.subscriptionPlan.delete({
            where: { id: starterPlanWithSuffix.id }
          });
          updatePlansLogger.info('Removed duplicate "Starter plan"');
        } catch (error: unknown) {
          updatePlansLogger.error('Error deleting duplicate Starter plan', { error: error instanceof Error ? error : new Error(String(error)) });
        }
      }
    }

    updatePlansLogger.info('All plans updated successfully');
  } catch (error) {
    updatePlansLogger.error('Error updating plans', { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  updatePlans()
    .then(() => {
      updatePlansLogger.info('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      updatePlansLogger.error('Script failed', { error: error instanceof Error ? error : new Error(String(error)) });
      process.exit(1);
    });
}

export default updatePlans;
