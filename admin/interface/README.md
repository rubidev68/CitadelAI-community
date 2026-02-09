# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/715486ef-80fc-473c-a756-fab3aeed2a9a

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/715486ef-80fc-473c-a756-fab3aeed2a9a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Key Features

### Multi-Step Registration Flow

The admin interface features a comprehensive 5-step registration process with email verification:

#### Registration Steps
1. **Account Setup**: Email and password collection with validation
2. **Email Verification**: URL-based verification with token handling
3. **Company Information**: Organization details collection
4. **Personal Information**: User profile setup
5. **First Chatbot Creation**: Automatic chatbot creation with interface

#### Key Features
- **State Persistence**: Registration data saved across browser sessions
- **Email Verification**: Real-time verification via URL parameters
- **Navigation Restrictions**: Prevents going back after email verification
- **Automatic Chatbot Creation**: Creates first chatbot with backend integration
- **Development Testing**: Console logging and visual helpers for easy testing
- **Responsive Design**: Consistent 512px width across all steps
- **Smooth Animations**: Direction-aware slide transitions between steps

#### Technical Implementation
- **RegistrationContext**: Manages multi-step state and navigation
- **URL Parameter Handling**: Processes verification tokens from email links
- **Backend Integration**: Seamless API calls for user and chatbot creation
- **Error Handling**: Comprehensive error states and user feedback
- **Accessibility**: Full keyboard navigation and screen reader support

### User Settings Modal

The admin interface includes a comprehensive User Settings Modal accessible from the dashboard. This modal provides three main functionality areas:

#### Profile Management
- **Personal Information Updates**: Modify name, email, and company information
- **Real-time UI Updates**: Changes are immediately reflected in the interface without requiring a page reload
- **Email Validation**: Ensures email uniqueness across the platform
- **Context Integration**: Updates are automatically synchronized with the AuthContext for consistent state management

#### Security Management
- **Password Changes**: Secure password updates with current password verification
- **Password Requirements**: Enforces minimum 6 character length validation
- **Confirmation System**: Requires new password confirmation to prevent input errors

#### Account Deletion (Danger Zone)
- **Cascading Deletion**: Safely removes all associated data in the correct dependency order:
  1. Connections (references blocks)
  2. Blocks (references chatbots)
  3. Website contexts (references chatbots)
  4. Chatbot access records (references chatbots)
  5. Chatbots (references admin user)
  6. Test user (if exists)
  7. Admin user account
- **Email Confirmation**: Requires typing the exact email address to confirm deletion
- **Data Warning**: Clear warning about what data will be permanently deleted
- **Transaction Safety**: All deletions are wrapped in a database transaction for data integrity

### Technical Implementation

The User Settings Modal is implemented using:
- **React Context API**: For state management and real-time updates
- **shadcn-ui Components**: For consistent UI design
- **TypeScript**: For type safety and better development experience
- **Prisma ORM**: For database operations with proper foreign key handling

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/715486ef-80fc-473c-a756-fab3aeed2a9a) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
