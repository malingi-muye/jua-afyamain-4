import { Appointment, InventoryItem, Patient } from '@/types'

interface ExportData {
  metrics: {
    totalPatients: number
    newPatients: number
    todayAppointments: number
    upcomingAppointments: number
    inQueuePatients: number
    completedVisits: number
    lowStockItems: number
    totalRevenue: number
    revenueTrend: number
    appointmentCompletionRate: string
    averagePatientWaitTime: string
  }
  appointments: Appointment[]
  patients: Patient[]
  inventory: InventoryItem[]
}

export function exportToCsv(data: ExportData, filename: string) {
  const csv: string[] = []

  // Header with timestamp
  csv.push(`JuaAfya Dashboard Report,${new Date().toISOString()}`)
  csv.push('')

  // Metrics Section
  csv.push('METRICS SUMMARY')
  csv.push('Metric,Value')
  csv.push(`Total Patients,${data.metrics.totalPatients}`)
  csv.push(`New Patients (This Month),${data.metrics.newPatients}`)
  csv.push(`Today's Appointments,${data.metrics.todayAppointments}`)
  csv.push(`Upcoming Appointments,${data.metrics.upcomingAppointments}`)
  csv.push(`Patients In Queue,${data.metrics.inQueuePatients}`)
  csv.push(`Completed Visits,${data.metrics.completedVisits}`)
  csv.push(`Low Stock Items,${data.metrics.lowStockItems}`)
  csv.push(`Total Revenue (KSh),${data.metrics.totalRevenue}`)
  csv.push(`Revenue Trend (%),${data.metrics.revenueTrend}`)
  csv.push(`Appointment Completion Rate (%),${data.metrics.appointmentCompletionRate}`)
  csv.push(`Average Patient Wait Time (min),${data.metrics.averagePatientWaitTime}`)
  csv.push('')

  // Appointments Section
  csv.push('APPOINTMENTS')
  csv.push('ID,Patient Name,Date,Time,Reason,Status')
  data.appointments.forEach((appointment) => {
    csv.push(
      `${appointment.id},"${appointment.patientName}",${appointment.date},${appointment.time},"${appointment.reason}",${appointment.status}`
    )
  })
  csv.push('')

  // Patients Section
  csv.push('PATIENTS')
  csv.push('ID,Name,Phone,Age,Gender,Last Visit,Notes')
  data.patients.forEach((patient) => {
    csv.push(
      `${patient.id},"${patient.name}",${patient.phone},${patient.age},${patient.gender},${patient.lastVisit},"${patient.notes || ''}"`
    )
  })
  csv.push('')

  // Inventory Section
  csv.push('INVENTORY - LOW STOCK ITEMS')
  csv.push('ID,Name,Category,Stock,Min Level,Unit,Price,Expiry Date')
  data.inventory.forEach((item) => {
    csv.push(
      `${item.id},"${item.name}",${item.category || 'N/A'},${item.stock},${item.minStockLevel},${item.unit || 'N/A'},${item.price || '0'},${item.expiryDate || 'N/A'}`
    )
  })

  // Create and download file
  const csvContent = csv.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportToPdf(data: ExportData, filename: string) {
  // Create a detailed HTML content for PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Dashboard Report</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #333;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #3B82F6;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #3B82F6;
          font-size: 28px;
          margin-bottom: 5px;
        }
        .header p {
          color: #666;
          font-size: 14px;
        }
        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          color: #3B82F6;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e5e7eb;
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
        }
        .metric-card {
          background: #f9fafb;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }
        .metric-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .metric-value {
          font-size: 20px;
          font-weight: bold;
          color: #3B82F6;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        thead {
          background: #f3f4f6;
          border-bottom: 2px solid #d1d5db;
        }
        th {
          padding: 10px;
          text-align: left;
          font-weight: 600;
          color: #374151;
        }
        td {
          padding: 8px 10px;
          border-bottom: 1px solid #e5e7eb;
        }
        tr:nth-child(even) {
          background: #f9fafb;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        @media print {
          body {
            padding: 20px;
          }
          .section {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>JuaAfya Dashboard Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
      </div>

      <!-- Metrics Section -->
      <div class="section">
        <h2 class="section-title">Key Metrics</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Total Patients</div>
            <div class="metric-value">${data.metrics.totalPatients}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">New Patients</div>
            <div class="metric-value">${data.metrics.newPatients}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Today's Appointments</div>
            <div class="metric-value">${data.metrics.todayAppointments}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Patients In Queue</div>
            <div class="metric-value">${data.metrics.inQueuePatients}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Completed Visits</div>
            <div class="metric-value">${data.metrics.completedVisits}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Revenue</div>
            <div class="metric-value">KSh ${(data.metrics.totalRevenue / 1000).toFixed(1)}K</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Low Stock Items</div>
            <div class="metric-value">${data.metrics.lowStockItems}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Revenue Trend</div>
            <div class="metric-value">${data.metrics.revenueTrend > 0 ? '+' : ''}${data.metrics.revenueTrend}%</div>
          </div>
        </div>
      </div>

      <!-- Appointments Section -->
      <div class="section">
        <h2 class="section-title">Recent Appointments</h2>
        <table>
          <thead>
            <tr>
              <th>Patient Name</th>
              <th>Date</th>
              <th>Time</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.appointments
              .slice(0, 10)
              .map(
                (a) => `
              <tr>
                <td>${a.patientName}</td>
                <td>${a.date}</td>
                <td>${a.time}</td>
                <td>${a.reason}</td>
                <td>${a.status}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        ${data.appointments.length > 10 ? `<p style="margin-top: 10px; color: #666; font-size: 12px;">... and ${data.appointments.length - 10} more appointments</p>` : ''}
      </div>

      <!-- Low Stock Inventory Section -->
      ${
        data.inventory.length > 0
          ? `
        <div class="section">
          <h2 class="section-title">Low Stock Inventory Items</h2>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Min Level</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              ${data.inventory
                .map(
                  (i) => `
                <tr>
                  <td>${i.name}</td>
                  <td>${i.category || 'N/A'}</td>
                  <td>${i.stock}</td>
                  <td>${i.minStockLevel}</td>
                  <td>${i.unit || 'N/A'}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `
          : ''
      }

      <div class="footer">
        <p>This is an automated report from JuaAfya Clinic Management System</p>
        <p>© 2025 JuaAfya. All rights reserved.</p>
      </div>
    </body>
    </html>
  `

  // Create PDF using browser's print functionality
  const printWindow = window.open('', '', 'height=600,width=800')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.print()

    // For actual PDF download (requires a PDF library)
    // You can optionally use a library like pdfkit or jsPDF here
  }
}
