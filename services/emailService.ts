import { supabase } from '@/lib/supabaseClient'
import logger from '@/lib/logger'

export interface EmailOptions {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
}

export interface EmailResponse {
  success: boolean
  message: string
  error?: string
  recipients?: number
}

/**
 * Send email via Gmail SMTP through Supabase Edge Function
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResponse> {
  try {
    // Validate at least one recipient
    const recipients = Array.isArray(options.to) ? options.to : [options.to]
    if (recipients.length === 0) {
      throw new Error('At least one recipient is required')
    }

    // Validate subject
    if (!options.subject || options.subject.trim() === '') {
      throw new Error('Email subject is required')
    }

    // Validate content
    if (!options.html && !options.text) {
      throw new Error('Email content (html or text) is required')
    }

    logger.log('Sending email via SMTP', {
      to: options.to,
      subject: options.subject,
    })

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: options,
    })

    if (error) {
      logger.error('Email sending failed:', error)
      throw error
    }

    logger.log('Email sent successfully', {
      to: options.to,
      subject: options.subject,
      recipients: data?.recipients || recipients.length,
    })

    return {
      success: true,
      message: data?.message || 'Email sent successfully',
      recipients: data?.recipients || recipients.length,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Error sending email:', errorMessage)

    return {
      success: false,
      message: 'Failed to send email',
      error: errorMessage,
    }
  }
}

/**
 * Send appointment confirmation email
 */
export async function sendAppointmentConfirmation(
  patientEmail: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  doctorName: string,
  clinicName: string,
): Promise<EmailResponse> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Appointment Confirmation</h2>
      <p>Dear ${patientName},</p>
      <p>Your appointment has been confirmed. Here are the details:</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Date:</strong> ${appointmentDate}</p>
        <p><strong>Time:</strong> ${appointmentTime}</p>
        <p><strong>Doctor:</strong> ${doctorName}</p>
        <p><strong>Clinic:</strong> ${clinicName}</p>
      </div>
      
      <p>Please arrive 10 minutes early. If you need to reschedule or cancel, please contact us as soon as possible.</p>
      
      <p>Best regards,<br/>${clinicName} Team</p>
    </div>
  `

  const text = `
    Appointment Confirmation
    
    Dear ${patientName},
    
    Date: ${appointmentDate}
    Time: ${appointmentTime}
    Doctor: ${doctorName}
    Clinic: ${clinicName}
    
    Please arrive 10 minutes early.
  `

  return sendEmail({
    to: patientEmail,
    subject: `Appointment Confirmation - ${clinicName}`,
    html,
    text,
  })
}

/**
 * Send appointment reminder email
 */
export async function sendAppointmentReminder(
  patientEmail: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicName: string,
): Promise<EmailResponse> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Appointment Reminder</h2>
      <p>Dear ${patientName},</p>
      <p>This is a reminder of your upcoming appointment:</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Date:</strong> ${appointmentDate}</p>
        <p><strong>Time:</strong> ${appointmentTime}</p>
        <p><strong>Clinic:</strong> ${clinicName}</p>
      </div>
      
      <p>Please arrive 10 minutes early. If you need to cancel or reschedule, please contact us.</p>
      
      <p>Best regards,<br/>${clinicName} Team</p>
    </div>
  `

  const text = `
    Appointment Reminder
    
    Dear ${patientName},
    
    Date: ${appointmentDate}
    Time: ${appointmentTime}
    Clinic: ${clinicName}
    
    Please arrive 10 minutes early.
  `

  return sendEmail({
    to: patientEmail,
    subject: `Reminder: Appointment at ${clinicName}`,
    html,
    text,
  })
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetLink: string,
): Promise<EmailResponse> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>We received a request to reset your password.</p>
      <p>Click the link below to reset your password (this link expires in 1 hour):</p>
      
      <div style="margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
      </div>
      
      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetLink}</p>
      
      <p style="margin-top: 30px; color: #999; font-size: 12px;">
        If you didn't request this, please ignore this email or contact support.
      </p>
    </div>
  `

  const text = `
    Password Reset Request
    
    We received a request to reset your password.
    Click this link to reset it (expires in 1 hour):
    ${resetLink}
    
    If you didn't request this, please ignore this email.
  `

  return sendEmail({
    to: email,
    subject: 'Password Reset Request - JuaAfya',
    html,
    text,
  })
}

/**
 * Send report export email
 */
export async function sendReportExportEmail(
  email: string,
  reportType: string,
  downloadLink: string,
  expiresIn: string = '7 days',
): Promise<EmailResponse> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Your Report Export is Ready</h2>
      <p>Hello,</p>
      <p>Your ${reportType} report export is ready for download.</p>
      
      <div style="margin: 30px 0;">
        <a href="${downloadLink}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Download Report
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        This download link will expire in ${expiresIn}.
      </p>
      
      <p>Best regards,<br/>JuaAfya Team</p>
    </div>
  `

  const text = `
    Your Report Export is Ready
    
    Download link: ${downloadLink}
    This link expires in ${expiresIn}.
  `

  return sendEmail({
    to: email,
    subject: `Your ${reportType} Report Export - JuaAfya`,
    html,
    text,
  })
}

/**
 * Send invitation email to new user
 */
export async function sendInvitationEmail(
  email: string,
  inviterName: string,
  clinicName: string,
  invitationLink: string,
): Promise<EmailResponse> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">You're Invited to ${clinicName}</h2>
      <p>Hello,</p>
      <p>${inviterName} has invited you to join <strong>${clinicName}</strong> on JuaAfya.</p>
      <p>JuaAfya is a modern clinic management system designed to streamline patient care.</p>
      
      <div style="margin: 30px 0;">
        <a href="${invitationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Accept Invitation
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        Or copy and paste this link: ${invitationLink}
      </p>
      
      <p>Best regards,<br/>JuaAfya Team</p>
    </div>
  `

  const text = `
    You're Invited to ${clinicName}
    
    ${inviterName} has invited you to join ${clinicName} on JuaAfya.
    
    Accept invitation: ${invitationLink}
  `

  return sendEmail({
    to: email,
    subject: `Invitation to join ${clinicName} - JuaAfya`,
    html,
    text,
  })
}

/**
 * Send lab results email
 */
export async function sendLabResultsEmail(
  patientEmail: string,
  patientName: string,
  testName: string,
  results: string,
  doctorName: string,
  clinicName: string,
): Promise<EmailResponse> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Your Lab Results are Ready</h2>
      <p>Dear ${patientName},</p>
      <p>Your lab results for <strong>${testName}</strong> are now available.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Test:</strong> ${testName}</p>
        <p><strong>Doctor:</strong> ${doctorName}</p>
        <p><strong>Results Summary:</strong></p>
        <p style="color: #666;">${results}</p>
      </div>
      
      <p>Please contact us if you have any questions about your results.</p>
      
      <p>Best regards,<br/>${clinicName} Team</p>
    </div>
  `

  const text = `
    Your Lab Results are Ready
    
    Test: ${testName}
    Doctor: ${doctorName}
    
    Results: ${results}
  `

  return sendEmail({
    to: patientEmail,
    subject: `Lab Results: ${testName} - ${clinicName}`,
    html,
    text,
  })
}
