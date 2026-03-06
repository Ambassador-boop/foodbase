import AddonForm from '@/components/addon-form';

export const metadata = {
  title: 'Add New Add-on',
  description: 'Add a new add-on group to your restaurant',
};

export default function NewAddonPage() {
  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Add New Add-on</h1>
        <p className="text-muted-foreground text-sm mt-1">Create a new add-on group (proteins, sides, toppings, etc.)</p>
      </div>
      <AddonForm />
    </div>
  );
}
