export interface WhatsAppTemplateRegistry {
  menuContentSid?: string;
  pickupScheduledSid?: string;
  collectorAssignedSid?: string;
  collectorEnRouteSid?: string;
  pickupCompletedSid?: string;
}

export const getWhatsAppTemplates = (): WhatsAppTemplateRegistry => ({
  menuContentSid: process.env.TWILIO_WHATSAPP_MENU_CONTENT_SID || undefined,
  pickupScheduledSid:
    process.env.TWILIO_WHATSAPP_PICKUP_SCHEDULED_CONTENT_SID || undefined,
  collectorAssignedSid:
    process.env.TWILIO_WHATSAPP_COLLECTOR_ASSIGNED_CONTENT_SID || undefined,
  collectorEnRouteSid:
    process.env.TWILIO_WHATSAPP_EN_ROUTE_CONTENT_SID || undefined,
  pickupCompletedSid:
    process.env.TWILIO_WHATSAPP_PICKUP_COMPLETED_CONTENT_SID || undefined,
});

