import { supabase } from '@/lib/supabaseClient'
import logger from '@/lib/logger'
import { mobiwaveService } from './mobiwaveService'

export interface SMSOptions {
  phone_number: string
  message: string
  sender_id?: string
}

export interface SMSResponse {
  success: boolean
  message: string
  error?: string
  sms_id?: string
}

/**
 * Send SMS via Mobiwave API
 */
export async function sendSMS(options: SMSOptions): Promise<SMSResponse> {
  try {
    // Validate phone number (basic validation)
    if (!options.phone_number || options.phone_number.trim() === '') {
      throw new Error('Phone number is required')
    }

    // Validate message
    if (!options.message || options.message.trim() === '') {
      throw new Error('Message is required')
    }

    // Ensure phone number is in international format
    let phoneNumber = options.phone_number.replace(/\D/g, '')
    if (!phoneNumber.startsWith('+')) {
      // Add country code if missing (assuming Kenya +254 for now)
      if (phoneNumber.length === 10 && (phoneNumber.startsWith('07') || phoneNumber.startsWith('01'))) {
        phoneNumber = '254' + phoneNumber.slice(1)
      } else if (phoneNumber.length === 9 && (phoneNumber.startsWith('7') || phoneNumber.startsWith('1'))) {
        phoneNumber = '254' + phoneNumber
      }
    } else {
      phoneNumber = phoneNumber.slice(1) // Mobiwave might not need the + sign depending on their implementation, 
      // but usually international numbers are passed as strings.
      // The docs show "8801721970168" which is international without +.
    }

    logger.log('Sending SMS via Mobiwave', {
      phone: phoneNumber.replace(/\d(?=\d{3})/g, '*'), // Mask phone for logs
      messageLength: options.message.length,
      sender_id: options.sender_id
    })

    const res = await mobiwaveService.sendSMS(phoneNumber, options.message, options.sender_id || 'JuaAfya');

    if (res.status === 'error') {
      logger.error('Mobiwave SMS sending failed:', res.message)
      return {
        success: false,
        message: res.message || 'Failed to send SMS',
        error: res.message
      }
    }

    logger.log('SMS sent successfully via Mobiwave')

    return {
      success: true,
      message: 'SMS sent successfully',
      sms_id: (res.data as any)?.uid || 'mobiwave-sms',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Error sending SMS:', errorMessage)

    return {
      success: false,
      message: 'Failed to send SMS',
      error: errorMessage,
    }
  }
}

/**
 * Send appointment reminder SMS
 */
export async function sendAppointmentReminderSMS(
  phoneNumber: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  doctorName: string,
  clinicName: string,
): Promise<SMSResponse> {
  const message = `Hi ${patientName}, reminder: You have an appointment with ${doctorName} at ${clinicName} on ${appointmentDate} at ${appointmentTime}. Please arrive 10 minutes early.`

  return sendSMS({
    phone_number: phoneNumber,
    message,
  })
}

/**
 * Send appointment confirmation SMS
 */
export async function sendAppointmentConfirmationSMS(
  phoneNumber: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  doctorName: string,
  clinicName: string,
): Promise<SMSResponse> {
  const message = `Hi ${patientName}, your appointment is confirmed with ${doctorName} at ${clinicName} on ${appointmentDate} at ${appointmentTime}.`

  return sendSMS({
    phone_number: phoneNumber,
    message,
  })
}

/**
 * Send SMS notification
 */
export async function sendNotificationSMS(
  phoneNumber: string,
  message: string,
): Promise<SMSResponse> {
  return sendSMS({
    phone_number: phoneNumber,
    message,
  })
}

/**
 * Send lab results SMS
 */
export async function sendLabResultsSMS(
  phoneNumber: string,
  patientName: string,
  testName: string,
  clinicName: string,
): Promise<SMSResponse> {
  const message = `Hi ${patientName}, your ${testName} lab results are ready at ${clinicName}. Please contact us for details.`

  return sendSMS({
    phone_number: phoneNumber,
    message,
  })
}

/**
 * Send payment reminder SMS
 */
export async function sendPaymentReminderSMS(
  phoneNumber: string,
  patientName: string,
  amount: number,
  dueDate: string,
  clinicName: string,
): Promise<SMSResponse> {
  const message = `Hi ${patientName}, payment reminder: KSh ${amount} due by ${dueDate} at ${clinicName}.`

  return sendSMS({
    phone_number: phoneNumber,
    message,
  })
}
