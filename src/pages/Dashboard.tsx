import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Calendar, Users, Gift, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'
import { formatDistanceToNow, parseISO, isToday, isTomorrow, addDays, isBefore } from 'date-fns'

interface UpcomingBirthday {
  id: string
  full_name: string
  avatar_url: string | null
  birthday: string
  daysUntil: number
}

export const Dashboard = () => {
  const { profile } = useAuth()
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthday[]>([])
  const [friendsCount, setFriendsCount] = useState(0)
  const [wishlistCount, setWishlistCount] = useState(0)

  useEffect(() => {
    fetchDashboardData()
  }, [profile])

  const fetchDashboardData = async () => {
    if (!profile) return

    try {
      // Fetch friends count
      const { count: friendsTotal } = await supabase
        .from('friendships')
        .select('*', { count: 'exact' })
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
        .eq('status', 'accepted')

      setFriendsCount(friendsTotal || 0)

      // Fetch wishlist items count
      const { count: wishlistTotal } = await supabase
        .from('wishlist_items')
        .select('*', { count: 'exact' })
        .eq('user_id', profile.id)

      setWishlistCount(wishlistTotal || 0)

      // Fetch upcoming birthdays (friends only)
      const { data: friends, error: friendsError } = await supabase
        .from('friendships')
        .select(`
          requester_id,
          addressee_id,
          requester:profiles!friendships_requester_id_fkey(id, full_name, avatar_url, birthday),
          addressee:profiles!friendships_addressee_id_fkey(id, full_name, avatar_url, birthday)
        `)
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
        .eq('status', 'accepted')

      if (friendsError) throw friendsError

      // Process friends' birthdays
      const friendProfiles = friends?.map((friend: any) => {
        // Get the friend's profile (not the current user's)
        const friendProfile = friend.requester_id === profile.id ? friend.addressee : friend.requester
        return friendProfile
      }).filter((friend: any) => friend && friend.birthday) || []

      const upcomingBdays = friendProfiles
        .map((friend: any) => {
          const birthday = parseISO(friend.birthday)
          const today = new Date()
          const thisYear = today.getFullYear()
          const nextBirthday = new Date(thisYear, birthday.getMonth(), birthday.getDate())
          
          // If birthday has passed this year, use next year
          if (isBefore(nextBirthday, today)) {
            nextBirthday.setFullYear(thisYear + 1)
          }
          
          const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          return {
            id: friend.id,
            full_name: friend.full_name || 'Unknown',
            avatar_url: friend.avatar_url,
            birthday: friend.birthday,
            daysUntil
          }
        })
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, 5) // Show only next 5 birthdays

      setUpcomingBirthdays(upcomingBdays)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }

  const getBirthdayBadge = (daysUntil: number) => {
    if (daysUntil === 0) return <Badge variant="destructive">Today!</Badge>
    if (daysUntil === 1) return <Badge variant="secondary">Tomorrow</Badge>
    if (daysUntil <= 7) return <Badge variant="outline">This week</Badge>
    return <Badge variant="outline">{daysUntil} days</Badge>
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">
          Welcome back, {profile?.full_name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-muted-foreground text-lg">
          Here's what's happening with your friends
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Friends</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{friendsCount}</div>
            <p className="text-xs text-muted-foreground">
              Connected friends
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wishlist Items</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wishlistCount}</div>
            <p className="text-xs text-muted-foreground">
              Items on your wishlist
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Birthdays</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingBirthdays.length}</div>
            <p className="text-xs text-muted-foreground">
              In the next 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Birthdays */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>🎂 Upcoming Birthdays</CardTitle>
              <CardDescription>Don't forget to wish your friends happy birthday!</CardDescription>
            </div>
            <Button asChild size="sm">
              <Link to="/calendar">
                <Calendar className="h-4 w-4 mr-2" />
                View Calendar
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingBirthdays.length > 0 ? (
            <div className="space-y-4">
              {upcomingBirthdays.map((birthday) => (
                <div key={birthday.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Avatar>
                      <AvatarImage src={birthday.avatar_url || undefined} />
                      <AvatarFallback>
                        {birthday.full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{birthday.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(birthday.birthday).toLocaleDateString('en-US', { 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                  {getBirthdayBadge(birthday.daysUntil)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No upcoming birthdays</p>
              <p className="text-sm">Add some friends to see their birthdays!</p>
              <Button asChild className="mt-4" size="sm">
                <Link to="/friends">
                  <Users className="h-4 w-4 mr-2" />
                  Find Friends
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage your profile and connections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/friends">
                <Users className="h-6 w-6 mb-2" />
                Find Friends
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/wishlist">
                <Gift className="h-6 w-6 mb-2" />
                Update Wishlist
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/profile">
                <Plus className="h-6 w-6 mb-2" />
                Edit Profile
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/calendar">
                <Calendar className="h-6 w-6 mb-2" />
                View Calendar
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}