import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Cake, Gift, Calendar, MessageCircle, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FeedActivity {
  id: string;
  type: 'birthday' | 'wishlist_item' | 'event' | 'birthday_greeting';
  user_id: string;
  content: string;
  metadata?: any;
  created_at: string;
  user?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface BirthdayGreeting {
  id: string;
  birthday_user_id: string;
  from_user_id: string;
  message: string;
  created_at: string;
  from_user?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export const Feed = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [todaysBirthdays, setTodaysBirthdays] = useState<any[]>([]);
  const [birthdayGreetings, setBirthdayGreetings] = useState<BirthdayGreeting[]>([]);
  const [greetingMessages, setGreetingMessages] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFeedActivities();
      fetchTodaysBirthdays();
      fetchBirthdayGreetings();
    }
  }, [user]);

  const fetchFeedActivities = async () => {
    try {
      // Simulate feed activities (in a real app, you'd have an activities table)
      const { data: friends, error: friendsError } = await supabase
        .from('friendships')
        .select(`
          *,
          requester:profiles!friendships_requester_id_fkey(id, full_name, avatar_url, birthday),
          addressee:profiles!friendships_addressee_id_fkey(id, full_name, avatar_url, birthday)
        `)
        .or(`requester_id.eq.${user?.id},addressee_id.eq.${user?.id}`)
        .eq('status', 'accepted');

      if (friendsError) throw friendsError;

      const friendsList = friends?.map(friendship => {
        return friendship.requester_id === user?.id 
          ? friendship.addressee 
          : friendship.requester;
      }) || [];

      // Create mock activities based on recent birthdays and events
      const mockActivities: FeedActivity[] = friendsList
        .filter(friend => friend.birthday)
        .map(friend => ({
          id: `birthday-${friend.id}`,
          type: 'birthday' as const,
          user_id: friend.id,
          content: `${friend.full_name} celebrated their birthday!`,
          created_at: friend.birthday,
          user: friend
        }))
        .slice(0, 5);

      setActivities(mockActivities);
    } catch (error) {
      console.error('Error fetching feed activities:', error);
    }
  };

  const fetchTodaysBirthdays = async () => {
    try {
      const today = new Date();
      const todayString = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const { data: friends, error } = await supabase
        .from('friendships')
        .select(`
          *,
          requester:profiles!friendships_requester_id_fkey(id, full_name, avatar_url, birthday),
          addressee:profiles!friendships_addressee_id_fkey(id, full_name, avatar_url, birthday)
        `)
        .or(`requester_id.eq.${user?.id},addressee_id.eq.${user?.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const friendsList = friends?.map(friendship => {
        return friendship.requester_id === user?.id 
          ? friendship.addressee 
          : friendship.requester;
      }) || [];

      const birthdayFriends = friendsList.filter(friend => {
        if (!friend.birthday) return false;
        const birthDate = new Date(friend.birthday);
        const birthString = `${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`;
        return birthString === todayString;
      });

      setTodaysBirthdays(birthdayFriends);
    } catch (error) {
      console.error('Error fetching today\'s birthdays:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBirthdayGreetings = async () => {
    try {
      // Check if user has birthday today
      if (!user) return;

      const today = new Date();
      const todayString = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('birthday')
        .eq('id', user.id)
        .single();

      if (profileError || !profile.birthday) return;

      const birthDate = new Date(profile.birthday);
      const birthString = `${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`;
      
      if (birthString !== todayString) return;

      // Fetch birthday greetings for today
      const { data: greetings, error: greetingsError } = await supabase
        .from('birthday_greetings')
        .select(`
          *,
          from_user:profiles!birthday_greetings_from_user_id_fkey(full_name, avatar_url)
        `)
        .eq('birthday_user_id', user.id)
        .gte('created_at', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false });

      if (greetingsError) throw greetingsError;
      setBirthdayGreetings(greetings || []);
    } catch (error) {
      console.error('Error fetching birthday greetings:', error);
    }
  };

  const sendBirthdayGreeting = async (birthdayUserId: string) => {
    const message = greetingMessages[birthdayUserId];
    if (!message?.trim()) {
      toast({
        title: "Empty Message",
        description: "Please write a birthday message.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('birthday_greetings')
        .insert({
          birthday_user_id: birthdayUserId,
          from_user_id: user?.id,
          message: message.trim()
        });

      if (error) throw error;

      toast({
        title: "Greeting Sent!",
        description: "Your birthday message has been sent.",
      });

      setGreetingMessages({
        ...greetingMessages,
        [birthdayUserId]: ''
      });
    } catch (error) {
      console.error('Error sending birthday greeting:', error);
      toast({
        title: "Error",
        description: "Failed to send birthday greeting.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">Loading feed...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Activity Feed</h1>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Today's Birthdays */}
          {todaysBirthdays.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cake className="h-5 w-5" />
                  🎉 Today's Birthdays!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {todaysBirthdays.map((friend) => (
                  <div key={friend.id} className="flex items-start gap-3">
                    <Avatar>
                      <AvatarImage src={friend.avatar_url} />
                      <AvatarFallback>
                        {friend.full_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">
                        It's {friend.full_name}'s birthday today! 🎂
                      </p>
                      <div className="mt-2">
                        <Textarea
                          placeholder="Write a birthday message..."
                          value={greetingMessages[friend.id] || ''}
                          onChange={(e) => setGreetingMessages({
                            ...greetingMessages,
                            [friend.id]: e.target.value
                          })}
                          className="min-h-[80px]"
                        />
                        <Button 
                          className="mt-2"
                          onClick={() => sendBirthdayGreeting(friend.id)}
                        >
                          <Heart className="h-4 w-4 mr-2" />
                          Send Birthday Wishes
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Birthday Greetings Received */}
          {birthdayGreetings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Birthday Messages for You! 🎉
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {birthdayGreetings.map((greeting) => (
                  <div key={greeting.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Avatar>
                      <AvatarImage src={greeting.from_user?.avatar_url} />
                      <AvatarFallback>
                        {greeting.from_user?.full_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {greeting.from_user?.full_name}
                      </p>
                      <p className="mt-1">{greeting.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(greeting.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activities.length === 0 ? (
                <p className="text-muted-foreground">No recent activities.</p>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <Avatar>
                      <AvatarImage src={activity.user?.avatar_url} />
                      <AvatarFallback>
                        {activity.user?.full_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {activity.type === 'birthday' && <Cake className="h-4 w-4" />}
                        {activity.type === 'wishlist_item' && <Gift className="h-4 w-4" />}
                        {activity.type === 'event' && <Calendar className="h-4 w-4" />}
                        <Badge variant="outline">{activity.type.replace('_', ' ')}</Badge>
                      </div>
                      <p>{activity.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{todaysBirthdays.length}</div>
                <div className="text-sm text-muted-foreground">Birthdays Today</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{birthdayGreetings.length}</div>
                <div className="text-sm text-muted-foreground">Messages Received</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};