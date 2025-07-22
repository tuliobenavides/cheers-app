import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, UserPlus, Search, Check, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

interface User {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  birthday: string | null
}

interface Friend extends User {
  status: 'accepted' | 'pending' | 'declined'
  friendship_id: string
  is_requester: boolean
}

export const Friends = () => {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) {
      fetchFriends()
    }
  }, [profile])

  useEffect(() => {
    if (searchQuery.length > 2) {
      searchUsers()
    } else {
      setSearchResults([])
    }
  }, [searchQuery])

  const fetchFriends = async () => {
    if (!profile) return

    try {
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select(`
          id,
          requester_id,
          addressee_id,
          status,
          requester:profiles!friendships_requester_id_fkey(id, full_name, email, avatar_url, birthday),
          addressee:profiles!friendships_addressee_id_fkey(id, full_name, email, avatar_url, birthday)
        `)
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)

      if (error) throw error

      const processedFriends: Friend[] = []
      const processedPending: Friend[] = []

      friendships?.forEach((friendship: any) => {
        const isRequester = friendship.requester_id === profile.id
        const friendProfile = isRequester ? friendship.addressee : friendship.requester

        const friendData: Friend = {
          id: friendProfile.id,
          full_name: friendProfile.full_name,
          email: friendProfile.email,
          avatar_url: friendProfile.avatar_url,
          birthday: friendProfile.birthday,
          status: friendship.status,
          friendship_id: friendship.id,
          is_requester: isRequester
        }

        if (friendship.status === 'accepted') {
          processedFriends.push(friendData)
        } else if (friendship.status === 'pending') {
          processedPending.push(friendData)
        }
      })

      setFriends(processedFriends)
      setPendingRequests(processedPending)
    } catch (error) {
      console.error('Error fetching friends:', error)
      toast({
        title: "Error",
        description: "Failed to load friends. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const searchUsers = async () => {
    if (!profile) return

    setIsSearching(true)
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, birthday')
        .neq('id', profile.id)
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(10)

      if (error) throw error

      // Filter out users who are already friends or have pending requests
      const existingConnections = [...friends, ...pendingRequests].map(f => f.id)
      const filteredUsers = users?.filter(user => !existingConnections.includes(user.id)) || []

      setSearchResults(filteredUsers)
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const sendFriendRequest = async (userId: string) => {
    if (!profile) return

    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          requester_id: profile.id,
          addressee_id: userId,
          status: 'pending'
        })

      if (error) throw error

      toast({
        title: "Friend request sent!",
        description: "Your friend request has been sent successfully.",
      })

      // Refresh friends list and clear search
      await fetchFriends()
      setSearchQuery('')
      setSearchResults([])
    } catch (error) {
      console.error('Error sending friend request:', error)
      toast({
        title: "Error",
        description: "Failed to send friend request. Please try again.",
        variant: "destructive",
      })
    }
  }

  const respondToFriendRequest = async (friendshipId: string, action: 'accept' | 'decline') => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: action === 'accept' ? 'accepted' : 'declined' })
        .eq('id', friendshipId)

      if (error) throw error

      toast({
        title: action === 'accept' ? "Friend request accepted!" : "Friend request declined",
        description: `You have ${action === 'accept' ? 'accepted' : 'declined'} the friend request.`,
      })

      await fetchFriends()
    } catch (error) {
      console.error('Error responding to friend request:', error)
      toast({
        title: "Error",
        description: "Failed to respond to friend request. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse text-lg">Loading friends...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
          <Users className="h-10 w-10" />
          Friends
        </h1>
        <p className="text-muted-foreground text-lg">
          Connect with friends and never miss their birthdays
        </p>
      </div>

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends">Friends ({friends.length})</TabsTrigger>
          <TabsTrigger value="requests">Requests ({pendingRequests.filter(r => !r.is_requester).length})</TabsTrigger>
          <TabsTrigger value="search">Find Friends</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Friends</CardTitle>
              <CardDescription>People you're connected with</CardDescription>
            </CardHeader>
            <CardContent>
              {friends.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {friends.map((friend) => (
                    <Card key={friend.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={friend.avatar_url || undefined} />
                            <AvatarFallback>
                              {friend.full_name?.charAt(0)?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{friend.full_name}</p>
                            <p className="text-sm text-muted-foreground">{friend.email}</p>
                            {friend.birthday && (
                              <p className="text-sm text-muted-foreground">
                                🎂 {new Date(friend.birthday).toLocaleDateString('en-US', { 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No friends yet</p>
                  <p className="text-sm">Start by searching for people to connect with!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Friend Requests</CardTitle>
              <CardDescription>People who want to connect with you</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRequests.filter(r => !r.is_requester).length > 0 ? (
                <div className="space-y-4">
                  {pendingRequests.filter(r => !r.is_requester).map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Avatar>
                          <AvatarImage src={request.avatar_url || undefined} />
                          <AvatarFallback>
                            {request.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.full_name}</p>
                          <p className="text-sm text-muted-foreground">{request.email}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          onClick={() => respondToFriendRequest(request.friendship_id, 'accept')}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => respondToFriendRequest(request.friendship_id, 'decline')}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending friend requests</p>
                </div>
              )}

              {pendingRequests.filter(r => r.is_requester).length > 0 && (
                <>
                  <div className="mt-8">
                    <h3 className="text-lg font-medium mb-4">Sent Requests</h3>
                    <div className="space-y-4">
                      {pendingRequests.filter(r => r.is_requester).map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <Avatar>
                              <AvatarImage src={request.avatar_url || undefined} />
                              <AvatarFallback>
                                {request.full_name?.charAt(0)?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{request.full_name}</p>
                              <p className="text-sm text-muted-foreground">{request.email}</p>
                            </div>
                          </div>
                          <Badge variant="outline">Pending</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Find Friends</CardTitle>
              <CardDescription>Search for people by name or email</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {isSearching && (
                <div className="text-center py-4">
                  <div className="animate-pulse">Searching...</div>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-4">
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Avatar>
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>
                            {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => sendFriendRequest(user.id)}>
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add Friend
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.length > 2 && !isSearching && searchResults.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No users found</p>
                  <p className="text-sm">Try a different search term</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}