import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, Check, X, Download, Loader2 } from 'lucide-react';
import { Patient, Gender } from '../types';

interface BulkImportPatientsProps {
  onImport: (patients: Patient[]) => Promise<void>;
  onClose: () => void;
}

interface ParsedPatient {
  data: Partial<Patient>;
  errors: string[];
}

const BulkImportPatients: React.FC<BulkImportPatientsProps> = ({ onImport, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedPatients, setParsedPatients] = useState<ParsedPatient[]>([]);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'parsed' | 'importing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiredFields = ['name', 'phone', 'age', 'gender'];
  const optionalFields = ['notes', 'allergies', 'chronicConditions', 'bloodGroup', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRel'];

  const downloadTemplate = () => {
    const headers = [...requiredFields, ...optionalFields];
    const templateRow = headers.map(field => {
      const fieldExamples: Record<string, string> = {
        name: 'John Doe',
        phone: '+254712345678',
        age: '35',
        gender: 'Male',
        notes: 'Diabetes patient',
        allergies: 'Penicillin, Sulfa',
        chronicConditions: 'Hypertension, Diabetes',
        bloodGroup: 'O+',
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '+254712345679',
        emergencyContactRel: 'Spouse'
      };
      return fieldExamples[field] || '';
    });

    const csv = [headers.join(','), templateRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patient-import-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (csvContent: string): ParsedPatient[] => {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      setErrorMessage('CSV file must contain at least a header row and one data row');
      return [];
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const patients: ParsedPatient[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.every(v => !v)) continue; // Skip empty rows

      const errors: string[] = [];
      const patientData: Partial<Patient> = {
        history: [],
        lastVisit: new Date().toISOString().split('T')[0],
      };

      // Process each column
      headers.forEach((header, index) => {
        const value = values[index] || '';

        switch (header) {
          case 'name':
            if (!value) {
              errors.push('Name is required');
            } else {
              patientData.name = value;
            }
            break;
          case 'phone':
            if (!value) {
              errors.push('Phone is required');
            } else {
              patientData.phone = value;
            }
            break;
          case 'age':
            if (!value) {
              errors.push('Age is required');
            } else {
              const ageNum = parseInt(value, 10);
              if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
                errors.push('Age must be a valid number between 0 and 150');
              } else {
                patientData.age = ageNum;
              }
            }
            break;
          case 'gender':
            if (!value) {
              errors.push('Gender is required');
            } else if (!Object.values(Gender).includes(value as Gender)) {
              errors.push(`Gender must be one of: ${Object.values(Gender).join(', ')}`);
            } else {
              patientData.gender = value as Gender;
            }
            break;
          case 'notes':
            patientData.notes = value || '';
            break;
          case 'allergies':
            patientData.allergies = value
              ? value.split(';').map(a => a.trim()).filter(a => a)
              : [];
            break;
          case 'chronicconditions':
            patientData.chronicConditions = value
              ? value.split(';').map(c => c.trim()).filter(c => c)
              : [];
            break;
          case 'bloodgroup':
            patientData.bloodGroup = value || '';
            break;
          case 'emergencycontactname':
            if (value || patientData.emergencyContact) {
              patientData.emergencyContact = {
                ...patientData.emergencyContact,
                name: value,
                phone: patientData.emergencyContact?.phone || '',
                relationship: patientData.emergencyContact?.relationship || ''
              };
            }
            break;
          case 'emergencycontactphone':
            if (value || patientData.emergencyContact) {
              patientData.emergencyContact = {
                ...patientData.emergencyContact,
                name: patientData.emergencyContact?.name || '',
                phone: value,
                relationship: patientData.emergencyContact?.relationship || ''
              };
            }
            break;
          case 'emergencycontactrel':
            if (value || patientData.emergencyContact) {
              patientData.emergencyContact = {
                ...patientData.emergencyContact,
                name: patientData.emergencyContact?.name || '',
                phone: patientData.emergencyContact?.phone || '',
                relationship: value
              };
            }
            break;
        }
      });

      // Generate temporary ID
      if (!errors.length || patientData.name) {
        patientData.id = `temp-bulk-${Date.now()}-${i}`;
      }

      patients.push({
        data: patientData,
        errors
      });
    }

    return patients;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportStatus('idle');
    setErrorMessage('');

    try {
      const content = await selectedFile.text();
      const parsed = parseCSV(content);

      if (parsed.length === 0) {
        setImportStatus('error');
        return;
      }

      setParsedPatients(parsed);
      setImportStatus('parsed');
    } catch (error) {
      setErrorMessage(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setImportStatus('error');
    }
  };

  const handleImport = async () => {
    const validPatients = parsedPatients
      .filter(p => p.errors.length === 0)
      .map(p => p.data as Patient);

    if (validPatients.length === 0) {
      setErrorMessage('No valid patients to import');
      return;
    }

    setImporting(true);
    setImportStatus('importing');

    try {
      await onImport(validPatients);
      setImportStatus('success');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setErrorMessage(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setImportStatus('error');
      setImporting(false);
    }
  };

  const validCount = parsedPatients.filter(p => p.errors.length === 0).length;
  const invalidCount = parsedPatients.filter(p => p.errors.length > 0).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-950 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between border-b">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Bulk Import Patients</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {importStatus === 'idle' && (
            <div className="space-y-6">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <p className="mb-3">Import multiple patients from a CSV file. Required fields: Name, Phone, Age, Gender</p>
                <button
                  onClick={downloadTemplate}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm flex items-center gap-1 mb-4"
                >
                  <Download className="w-4 h-4" />
                  Download CSV Template
                </button>
              </div>

              <div className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg p-8 text-center bg-blue-50/50 dark:bg-blue-950/30 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
                <p className="text-slate-900 dark:text-white font-medium mb-1">Choose CSV file</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">or drag and drop here</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {errorMessage && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
                </div>
              )}
            </div>
          )}

          {importStatus === 'parsed' && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
                <Check className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Found <strong>{validCount}</strong> valid patient{validCount !== 1 ? 's' : ''}{invalidCount > 0 && ` and ${invalidCount} invalid record${invalidCount !== 1 ? 's' : ''}`}
                </p>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white">Status</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white">Name</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white">Phone</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white">Age</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white">Gender</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {parsedPatients.slice(0, 5).map((patient, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-2">
                          {patient.errors.length === 0 ? (
                            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-900 dark:text-white">{patient.data.name || '-'}</td>
                        <td className="px-4 py-2 text-slate-900 dark:text-white">{patient.data.phone || '-'}</td>
                        <td className="px-4 py-2 text-slate-900 dark:text-white">{patient.data.age || '-'}</td>
                        <td className="px-4 py-2 text-slate-900 dark:text-white">{patient.data.gender || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedPatients.length > 5 && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 px-4 py-2">
                    ... and {parsedPatients.length - 5} more patient{parsedPatients.length - 5 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Error details */}
              {invalidCount > 0 && (
                <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <p className="text-sm font-semibold text-orange-900 dark:text-orange-200 mb-2">Issues found:</p>
                  <ul className="space-y-1 text-xs text-orange-800 dark:text-orange-300">
                    {parsedPatients.map((patient, idx) => 
                      patient.errors.length > 0 && (
                        <li key={idx}>
                          <span className="font-medium">{patient.data.name || `Row ${idx + 2}`}:</span> {patient.errors.join(', ')}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setImportStatus('idle');
                    setFile(null);
                    setParsedPatients([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  Choose Different File
                </button>
                <button
                  onClick={handleImport}
                  disabled={validCount === 0 || importing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Import {validCount} Patient{validCount !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {importStatus === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mb-4" />
              <p className="text-slate-700 dark:text-slate-300 font-medium">Importing patients...</p>
            </div>
          )}

          {importStatus === 'success' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="bg-green-100 dark:bg-green-950/30 rounded-full p-3 mb-4">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-slate-900 dark:text-white font-semibold">Import completed successfully!</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{validCount} patient{validCount !== 1 ? 's' : ''} imported</p>
            </div>
          )}

          {importStatus === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{errorMessage || 'An error occurred during import'}</p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setImportStatus('idle');
                    setFile(null);
                    setParsedPatients([]);
                    setErrorMessage('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkImportPatients;
