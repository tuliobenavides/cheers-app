import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { Gift, Plus, Edit, Trash2, ExternalLink } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase, WishListItem } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

const wishlistItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  price_tier: z.enum(['under_25', '25_to_50', 'over_50']),
  affiliate_link: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
})

export const Wishlist = () => {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [wishlistItems, setWishlistItems] = useState<WishListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingItem, setEditingItem] = useState<WishListItem | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const form = useForm<z.infer<typeof wishlistItemSchema>>({
    resolver: zodResolver(wishlistItemSchema),
    defaultValues: {
      title: '',
      description: '',
      price_tier: 'under_25',
      affiliate_link: '',
    },
  })

  useEffect(() => {
    if (profile) {
      fetchWishlistItems()
    }
  }, [profile])

  const fetchWishlistItems = async () => {
    if (!profile) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setWishlistItems(data || [])
    } catch (error) {
      console.error('Error fetching wishlist items:', error)
      toast({
        title: "Error",
        description: "Failed to load wishlist items. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (values: z.infer<typeof wishlistItemSchema>) => {
    if (!profile) return

    try {
      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from('wishlist_items')
          .update({
            title: values.title,
            description: values.description || null,
            price_tier: values.price_tier,
            affiliate_link: values.affiliate_link || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingItem.id)

        if (error) throw error

        toast({
          title: "Item updated!",
          description: "Your wishlist item has been updated successfully.",
        })
      } else {
        // Create new item
        const { error } = await supabase
          .from('wishlist_items')
          .insert({
            user_id: profile.id,
            title: values.title,
            description: values.description || null,
            price_tier: values.price_tier,
            affiliate_link: values.affiliate_link || null,
          })

        if (error) throw error

        toast({
          title: "Item added!",
          description: "Your wishlist item has been added successfully.",
        })
      }

      // Reset form and close dialog
      form.reset()
      setEditingItem(null)
      setIsDialogOpen(false)
      await fetchWishlistItems()
    } catch (error) {
      console.error('Error saving wishlist item:', error)
      toast({
        title: "Error",
        description: "Failed to save wishlist item. Please try again.",
        variant: "destructive",
      })
    }
  }

  const deleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('wishlist_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error

      toast({
        title: "Item deleted!",
        description: "Your wishlist item has been removed.",
      })

      await fetchWishlistItems()
    } catch (error) {
      console.error('Error deleting wishlist item:', error)
      toast({
        title: "Error",
        description: "Failed to delete wishlist item. Please try again.",
        variant: "destructive",
      })
    }
  }

  const startEdit = (item: WishListItem) => {
    setEditingItem(item)
    form.reset({
      title: item.title,
      description: item.description || '',
      price_tier: item.price_tier,
      affiliate_link: item.affiliate_link || '',
    })
    setIsDialogOpen(true)
  }

  const startNew = () => {
    setEditingItem(null)
    form.reset({
      title: '',
      description: '',
      price_tier: 'under_25',
      affiliate_link: '',
    })
    setIsDialogOpen(true)
  }

  const getPriceTierLabel = (tier: string) => {
    switch (tier) {
      case 'under_25': return 'Under $25'
      case '25_to_50': return '$25 - $50'
      case 'over_50': return 'Over $50'
      default: return tier
    }
  }

  const getPriceTierColor = (tier: string) => {
    switch (tier) {
      case 'under_25': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case '25_to_50': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'over_50': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse text-lg">Loading wishlist...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
          <Gift className="h-10 w-10" />
          My Wishlist
        </h1>
        <p className="text-muted-foreground text-lg">
          Create your gift wishlist for friends to discover perfect presents
        </p>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <p className="text-muted-foreground">
            {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} in your wishlist
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={startNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit Wishlist Item' : 'Add New Wishlist Item'}
              </DialogTitle>
              <DialogDescription>
                {editingItem ? 'Update your wishlist item details' : 'Add a new item to your wishlist for friends to see'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Wireless headphones" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add more details about what you'd like..."
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price_tier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price Range</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a price range" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="under_25">Under $25</SelectItem>
                          <SelectItem value="25_to_50">$25 - $50</SelectItem>
                          <SelectItem value="over_50">Over $50</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="affiliate_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shopping Link (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://amazon.com/dp/..." 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex space-x-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {wishlistItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlistItems.map((item) => (
            <Card key={item.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">{item.title}</CardTitle>
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => deleteItem(item.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Badge 
                  variant="secondary" 
                  className={`w-fit ${getPriceTierColor(item.price_tier)}`}
                >
                  {getPriceTierLabel(item.price_tier)}
                </Badge>
              </CardHeader>
              <CardContent>
                {item.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {item.description}
                  </p>
                )}
                {item.affiliate_link && (
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <a href={item.affiliate_link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Item
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Gift className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Your wishlist is empty</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Start adding items you'd love to receive as gifts. Your friends will be able to see them and know exactly what makes you happy!
            </p>
            <Button onClick={startNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Item
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}