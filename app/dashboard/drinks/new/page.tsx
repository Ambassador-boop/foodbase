import DrinkForm from '@/components/drink-form';

export const metadata = {
  title: 'Add New Drink',
  description: 'Add a new drink to your restaurant',
};

export default function NewDrinkPage() {
  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Add New Drink</h1>
        <p className="text-muted-foreground text-sm mt-1">Create a new beverage for your menu</p>
      </div>
      <DrinkForm />
    </div>
  );
}
