#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function ensureBucket(bucketName = 'avatars') {
  try {
    // List existing buckets
    const { data: buckets, error: listErr } = await supabase.storage.getBuckets()
    if (listErr) {
      console.error('Failed to list buckets:', listErr)
    } else {
      if (Array.isArray(buckets) && buckets.find((b) => b.name === bucketName)) {
        console.log(`Bucket '${bucketName}' already exists.`)
        return
      }
    }

    // Create bucket as private. We will use signed URLs for access.
    const { data, error } = await supabase.storage.createBucket(bucketName, { public: false })
    if (error) {
      console.error('Failed to create bucket:', error)
      process.exit(1)
    }

    console.log(`Bucket '${bucketName}' created successfully.`)
    console.log(data)
  } catch (e) {
    console.error('Unexpected error while ensuring bucket:', e)
    process.exit(1)
  }
}

ensureBucket().then(() => process.exit(0))
