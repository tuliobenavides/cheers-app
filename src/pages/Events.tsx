import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar, MapPin, Users, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Event {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  date: string;
  location: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  creator?: {
    full_name: string;
  };
}

interface EventInvitation {
  id: string;
  event_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  user?: {
    full_name: string;
  };
}

export const Events = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [invitations, setInvitations] = useState<EventInvitation[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Form state
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    is_private: true,
    invited_friends: [] as string[]
  });

  useEffect(() => {
    if (user) {
      fetchEvents();
      fetchInvitations();
      fetchFriends();
    }
  }, [user]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          creator:profiles(full_name)
        `)
        .eq('creator_id', user?.id)
        .order('date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('event_invitations')
        .select(`
          *,
          event:events(*),
          user:profiles(full_name)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  };

  const fetchFriends = async () => {
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          *,
          requester:profiles!friendships_requester_id_fkey(id, full_name),
          addressee:profiles!friendships_addressee_id_fkey(id, full_name)
        `)
        .or(`requester_id.eq.${user?.id},addressee_id.eq.${user?.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const friendsList = data?.map(friendship => {
        return friendship.requester_id === user?.id 
          ? friendship.addressee 
          : friendship.requester;
      }) || [];

      setFriends(friendsList);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async () => {
    if (!newEvent.title || !newEvent.date) {
      toast({
        title: "Validation Error",
        description: "Please fill in title and date.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          creator_id: user?.id,
          title: newEvent.title,
          description: newEvent.description,
          date: newEvent.date,
          location: newEvent.location,
          is_private: newEvent.is_private,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Send invitations
      if (newEvent.invited_friends.length > 0) {
        const invitations = newEvent.invited_friends.map(friendId => ({
          event_id: eventData.id,
          user_id: friendId,
          status: 'pending' as const
        }));

        const { error: inviteError } = await supabase
          .from('event_invitations')
          .insert(invitations);

        if (inviteError) throw inviteError;
      }

      toast({
        title: "Event Created",
        description: "Your event has been created successfully!",
      });

      setIsCreateDialogOpen(false);
      setNewEvent({
        title: '',
        description: '',
        date: '',
        location: '',
        is_private: true,
        invited_friends: []
      });
      
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        variant: "destructive",
      });
    }
  };

  const respondToInvitation = async (invitationId: string, status: 'accepted' | 'declined') => {
    try {
      const { error } = await supabase
        .from('event_invitations')
        .update({ status })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Response Sent",
        description: `You have ${status} the invitation.`,
      });

      fetchInvitations();
    } catch (error) {
      console.error('Error responding to invitation:', error);
      toast({
        title: "Error",
        description: "Failed to respond to invitation.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Events</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  placeholder="Birthday Party"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  placeholder="Join us for a celebration!"
                />
              </div>
              <div>
                <Label htmlFor="date">Date & Time</Label>
                <Input
                  id="date"
                  type="datetime-local"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                  placeholder="123 Party Street"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="private"
                  checked={newEvent.is_private}
                  onCheckedChange={(checked) => setNewEvent({...newEvent, is_private: checked})}
                />
                <Label htmlFor="private">Private Event</Label>
              </div>
              <div>
                <Label>Invite Friends</Label>
                <div className="max-h-32 overflow-y-auto space-y-2 mt-2">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={friend.id}
                        checked={newEvent.invited_friends.includes(friend.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewEvent({
                              ...newEvent,
                              invited_friends: [...newEvent.invited_friends, friend.id]
                            });
                          } else {
                            setNewEvent({
                              ...newEvent,
                              invited_friends: newEvent.invited_friends.filter(id => id !== friend.id)
                            });
                          }
                        }}
                      />
                      <Label htmlFor={friend.id}>{friend.full_name}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={createEvent} className="w-full">
                Create Event
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* My Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              My Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {events.length === 0 ? (
              <p className="text-muted-foreground">No events created yet.</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{event.title}</h3>
                    <Badge variant={event.is_private ? "secondary" : "outline"}>
                      {event.is_private ? "Private" : "Public"}
                    </Badge>
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(event.date).toLocaleDateString()}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {event.location}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Event Invitations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Invitations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invitations.length === 0 ? (
              <p className="text-muted-foreground">No invitations received.</p>
            ) : (
              invitations.map((invitation) => (
                <div key={invitation.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{(invitation as any).event?.title}</h3>
                    <Badge 
                      variant={
                        invitation.status === 'accepted' ? "default" :
                        invitation.status === 'declined' ? "destructive" : "secondary"
                      }
                    >
                      {invitation.status}
                    </Badge>
                  </div>
                  {(invitation as any).event?.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {(invitation as any).event.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date((invitation as any).event?.date).toLocaleDateString()}
                    </div>
                    {(invitation as any).event?.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {(invitation as any).event.location}
                      </div>
                    )}
                  </div>
                  {invitation.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => respondToInvitation(invitation.id, 'accepted')}
                      >
                        Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => respondToInvitation(invitation.id, 'declined')}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};