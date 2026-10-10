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

// ==================== RBAC PERMISSIONS ====================

// Fetch role permission by doc_id (format: DEPARTMENT_ROLE)
export async function fetchRolePermission(docId: string) {
  try {
    const { data: permission, error } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('doc_id', docId)
      .single();

    if (error || !permission) {
      return null;
    }

    return permission;
  } catch (error) {
    console.error('Fetch role permission error:', error);
    return null;
  }
}

// Fetch all role permissions
export async function fetchAllRolePermissions() {
  try {
    const { data: permissions, error } = await supabase
      .from('role_permissions')
      .select('*');

    if (error) {
      console.error('Fetch all role permissions error:', error);
      return [];
    }

    return permissions || [];
  } catch (error) {
    console.error('Fetch all role permissions error:', error);
    return [];
  }
}

// Save or update role permission
export async function saveRolePermission(docId: string, data: any) {
  try {
    const { error } = await supabase
      .from('role_permissions')
      .upsert({
        doc_id: docId,
        department: data.department,
        role: data.role,
        services: data.services,
        nav: data.nav,
        security: data.security,
        account: data.account,
        dashboard: data.dashboard,
        is_dashboard_allowed: data.is_dashboard_allowed,
        updated_at: new Date().toISOString(),
        updated_by: data.updatedBy,
      }, {
        onConflict: 'doc_id'
      });

    if (error) {
      console.error('Save role permission error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Save role permission error:', error);
    return false;
  }
}

// ==================== DEPARTMENT CONFIGS ====================

// Fetch all department configs
export async function fetchAllDepartmentConfigs() {
  try {
    const { data: configs, error } = await supabase
      .from('department_configs')
      .select('*')
      .eq('deleted', false);

    if (error) {
      console.error('Fetch department configs error:', error);
      return [];
    }

    return configs || [];
  } catch (error) {
    console.error('Fetch department configs error:', error);
    return [];
  }
}

// Fetch department config by name
export async function fetchDepartmentConfig(name: string) {
  try {
    const { data: config, error } = await supabase
      .from('department_configs')
      .select('*')
      .eq('name', name)
      .single();

    if (error || !config) {
      return null;
    }

    return config;
  } catch (error) {
    console.error('Fetch department config error:', error);
    return null;
  }
}

// Save or update department config
export async function saveDepartmentConfig(name: string, data: any) {
  try {
    const { error } = await supabase
      .from('department_configs')
      .upsert({
        name: name,
        roles: data.roles,
        color: data.color,
        deleted: data.deleted || false,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'name'
      });

    if (error) {
      console.error('Save department config error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Save department config error:', error);
    return false;
  }
}

// Delete department config (soft delete)
export async function deleteDepartmentConfig(name: string) {
  try {
    const { error } = await supabase
      .from('department_configs')
      .update({ deleted: true, updated_at: new Date().toISOString() })
      .eq('name', name);

    if (error) {
      console.error('Delete department config error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete department config error:', error);
    return false;
  }
}
