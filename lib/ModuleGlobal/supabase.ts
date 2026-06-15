import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Export Supabase client for use in API routes
export const getSupabaseClient = () => supabase;

// Validate user credentials
export async function validateUser({ Email, Password }: { Email: string; Password: string }) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('Email', Email)
      .single();

    if (error || !user) {
      return { success: false, message: 'Invalid email or password' };
    }

    // Compare the provided password with the stored hashed password
    const isValidPassword = await bcrypt.compare(Password, user.Password);
    if (!isValidPassword) {
      return { success: false, message: 'Invalid email or password' };
    }

    return { success: true, user };
  } catch (error) {
    console.error('Validation error:', error);
    return { success: false, message: 'Database error' };
  }
}

// Register a new user
export async function registerUser({
  userName,
  Email,
  Password,
}: {
  userName: string;
  Email: string;
  Password: string;
}) {
  try {
    // Check if the email already exists in the database
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('Email', Email)
      .single();

    if (existingUser) {
      return { success: false, message: 'Email already in use' };
    }

    // Hash the password before saving it to the database
    const hashedPassword = await bcrypt.hash(Password, 10);

    // Insert the new user into the collection
    const { error } = await supabase
      .from('users')
      .insert([
        {
          userName,
          Email,
          Password: hashedPassword,
          createdAt: new Date().toISOString(),
        },
      ]);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, message: 'Database error' };
  }
}

// Fetch user by ID
export async function fetchUserById(userId: string) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Fetch user error:', error);
    return null;
  }
}

// Fetch user by email
export async function fetchUserByEmail(email: string) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('Email', email)
      .single();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Fetch user error:', error);
    return null;
  }
}

// Fetch user by DeviceId
export async function fetchUserByDeviceId(deviceId: string) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('DeviceId', deviceId)
      .single();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Fetch user by device error:', error);
    return null;
  }
}

// Update user
export async function updateUser(userId: string, updates: Record<string, any>) {
  try {
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('Update error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Update user error:', error);
    return false;
  }
}
