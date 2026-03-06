import MenuItemForm from '@/components/menu-item-form';

export const metadata = {
  title: 'Add Menu Item',
  description: 'Add a new menu item to your restaurant',
};

export default function NewMenuItemPage() {
  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Add Menu Item</h1>
        <p className="text-muted-foreground text-sm mt-1">Create a new dish for your restaurant</p>
      </div>
      <MenuItemForm />
    </div>
  );
}
