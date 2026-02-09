/**
 * Calendar Actions API Routes
 * Handles confirmation and cancellation of calendar actions
 */

import express from 'express';
import { executeCalendarBlock } from '../services/calendarBlockExecutionService';
import {
  storePendingAction,
  getPendingAction,
  clearPendingAction,
  validateConfirmationToken,
  generateConfirmationToken,
  PendingCalendarAction,
} from '../services/calendarActionConfirmationService';
import { logCalendarAction } from '../services/calendarActionAuditService';
import prisma from '../lib/prisma';
import { logger, validateRequest } from '@shared/utils';
import {
  confirmCalendarActionSchema,
  cancelCalendarActionSchema,
} from '../validation/calendarActionsSchemas';

const router = express.Router();

/**
 * Confirm a calendar action
 * POST /api/calendar-actions/confirm
 */
router.post('/confirm', validateRequest(confirmCalendarActionSchema) as any, async (req, res) => {
  try {
    const { confirmationToken, slackUserId, slackChannel, slackMessageTs, apiToken } = req.body;
    
    
    // Validate token format
    if (!validateConfirmationToken(confirmationToken)) {
      logger.error('Invalid confirmation token format', undefined, {
        service: 'calendarActions-routes',
      });
      return res.status(400).json({ 
        success: false,
        error: 'Invalid confirmation token format',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Get pending action
    const pendingAction = await getPendingAction(confirmationToken);
    if (!pendingAction) {
      logger.warn('Pending action not found or expired', {
        service: 'calendarActions-routes',
      });
      return res.status(404).json({ 
        success: false,
        error: 'Action not found or expired',
        code: 'CONFIRMATION_EXPIRED'
      });
    }
    
    
    // Verify integration type matches
    if (pendingAction.integrationType === 'slack' && !slackUserId) {
      return res.status(400).json({ 
        success: false,
        error: 'Slack user ID required for Slack actions',
        code: 'MISSING_SLACK_USER_ID'
      });
    }
    
    if (pendingAction.integrationType === 'api' && !apiToken) {
      return res.status(400).json({ 
        success: false,
        error: 'API token required for API actions',
        code: 'MISSING_API_TOKEN'
      });
    }
    
    // Get block
    const block = await prisma.block.findUnique({ 
      where: { id: pendingAction.blockId } 
    });
    
    if (!block) {
      return res.status(404).json({ 
        success: false,
        error: 'Block not found',
        code: 'BLOCK_NOT_FOUND'
      });
    }
    
    // Execute the action
    const result = await executeCalendarBlock(
      block,
      pendingAction.userId,
      pendingAction.chatbotId,
      pendingAction.userMessage,
      {},
      pendingAction.slackUserId || slackUserId || undefined,
      pendingAction.sessionId, // Pass sessionId for cache lookup
      pendingAction.eventDetails, // Pass AI-extracted event details
      pendingAction.action, // Pass AI-detected action type
      pendingAction.cachedEventInfo // Pass cached event info to avoid re-searching
    );
    
    // Check if authentication is required
    if (result.requiresAuth === true) {
      // Log failed action due to missing auth
      try {
        await logCalendarAction({
          userId: pendingAction.userId || 'unknown',
          chatbotId: pendingAction.chatbotId,
          blockId: pendingAction.blockId,
          action: pendingAction.action,
          eventId: undefined,
          eventDetails: pendingAction.eventDetails,
          success: false,
          error: 'Authentication required. Please authenticate your calendar account first.',
        });
      } catch (logError) {
        logger.error('Failed to log action', logError instanceof Error ? logError : undefined, {
          service: 'calendarActions-routes',
        });
      }
      
      // Clear pending action
      await clearPendingAction(confirmationToken);
      
      // Return error response
      return res.status(400).json({
        success: false,
        error: 'Calendar authentication required',
        code: 'AUTH_REQUIRED',
        authUrl: result.authUrl,
        provider: result.provider,
      });
    }
    
    // Log action (only if not requiring auth)
    try {
      const actionSuccess = !result.error && (result.eventCreated === true || result.eventUpdated === true || result.eventDeleted === true);
      await logCalendarAction({
        userId: pendingAction.userId || 'unknown',
        chatbotId: pendingAction.chatbotId,
        blockId: pendingAction.blockId,
        action: pendingAction.action,
        eventId: result.eventId,
        eventDetails: pendingAction.eventDetails,
        success: actionSuccess,
        error: result.error,
      });
    } catch (logError) {
      logger.error('Failed to log action', logError instanceof Error ? logError : undefined, {
        service: 'calendarActions-routes',
      });
      // Don't fail the request if logging fails
    }
    
    // Clear pending action
    await clearPendingAction(confirmationToken);
    
    // Return result (format depends on integration type)
    const actionSuccess = !result.error && (result.eventCreated === true || result.eventUpdated === true || result.eventDeleted === true);
    
    if (pendingAction.integrationType === 'slack') {
      // Slack-specific response (will be handled by admin-backend)
      res.json({
        success: actionSuccess,
        result,
        slackChannel,
        slackMessageTs,
      });
    } else {
      // API/Web response
      res.json({
        success: actionSuccess,
        result,
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Confirmation failed';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Confirmation error', error instanceof Error ? error : undefined, {
      confirmationToken: req.body.confirmationToken?.substring(0, 8) + '...',
      service: 'calendarActions-routes',
    });
    
    // Try to get pending action for logging
    const { confirmationToken } = req.body;
    const pendingAction = confirmationToken ? await getPendingAction(confirmationToken) : null;
    
    if (pendingAction) {
      // Log failed action
      try {
        await logCalendarAction({
          userId: pendingAction.userId || 'unknown',
          chatbotId: pendingAction.chatbotId,
          blockId: pendingAction.blockId,
          action: pendingAction.action,
          eventDetails: pendingAction.eventDetails,
          success: false,
          error: errorMessage,
        });
      } catch (logError) {
        logger.error('Failed to log failed action', logError instanceof Error ? logError : undefined, {
          service: 'calendarActions-routes',
        });
      }
      
      // Clear pending action on error
      await clearPendingAction(confirmationToken);
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage || 'Failed to execute calendar action',
      code: 'EXECUTION_ERROR'
    });
  }
});

/**
 * Cancel a calendar action
 * POST /api/calendar-actions/cancel
 */
router.post('/cancel', validateRequest(cancelCalendarActionSchema) as any, async (req, res) => {
  try {
    const { confirmationToken } = req.body;
    
    if (!confirmationToken) {
      return res.status(400).json({ 
        success: false,
        error: 'Confirmation token required',
        code: 'MISSING_TOKEN'
      });
    }
    
    const pendingAction = await getPendingAction(confirmationToken);
    if (pendingAction) {
      await clearPendingAction(confirmationToken);
      
      // Log cancellation
      try {
        await logCalendarAction({
          userId: pendingAction.userId || 'unknown',
          chatbotId: pendingAction.chatbotId,
          blockId: pendingAction.blockId,
          action: pendingAction.action,
          eventId: undefined,
          eventDetails: pendingAction.eventDetails,
          success: false,
          error: 'Action cancelled by user',
        });
      } catch (logError) {
        logger.error('Failed to log cancellation', logError instanceof Error ? logError : undefined, {
          service: 'calendarActions-routes',
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Action cancelled' 
      });
    } else {
      res.json({ 
        success: true, 
        message: 'Action not found (may have already expired)' 
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Cancel failed';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Cancel error', error instanceof Error ? error : undefined, {
      service: 'calendarActions-routes',
    });
    res.status(500).json({
      success: false,
      error: errorMessage || 'Failed to cancel action',
      code: 'CANCEL_ERROR'
    });
  }
});

export default router;
export { storePendingAction, getPendingAction, clearPendingAction, generateConfirmationToken };
