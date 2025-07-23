import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export const NotificationSystem = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const checkBirthdayNotifications = async () => {
      try {
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        const nextMonth = new Date();
        nextMonth.setDate(today.getDate() + 30);

        // Get friends' birthdays
        const { data: friends, error } = await supabase
          .from('friendships')
          .select(`
            *,
            requester:profiles!friendships_requester_id_fkey(id, full_name, birthday),
            addressee:profiles!friendships_addressee_id_fkey(id, full_name, birthday)
          `)
          .or(`requester_id.eq.${user?.id},addressee_id.eq.${user?.id}`)
          .eq('status', 'accepted');

        if (error) throw error;

        const friendsList = friends?.map(friendship => {
          return friendship.requester_id === user?.id 
            ? friendship.addressee 
            : friendship.requester;
        }) || [];

        // Check for birthdays today
        const todaysBirthdays = friendsList.filter(friend => {
          if (!friend.birthday) return false;
          const birthDate = new Date(friend.birthday);
          const todayString = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const birthString = `${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`;
          return birthString === todayString;
        });

        // Check for birthdays next week
        const nextWeekBirthdays = friendsList.filter(friend => {
          if (!friend.birthday) return false;
          const birthDate = new Date(friend.birthday);
          const nextWeekString = `${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;
          const birthString = `${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`;
          return birthString === nextWeekString;
        });

        // Show notifications
        if (todaysBirthdays.length > 0) {
          toast({
            title: "🎉 Birthday Alert!",
            description: `It's ${todaysBirthdays.map(f => f.full_name).join(', ')}'s birthday today!`,
            duration: 8000,
          });
        }

        if (nextWeekBirthdays.length > 0) {
          toast({
            title: "📅 Upcoming Birthday",
            description: `${nextWeekBirthdays.map(f => f.full_name).join(', ')} has a birthday next week!`,
            duration: 6000,
          });
        }

      } catch (error) {
        console.error('Error checking birthday notifications:', error);
      }
    };

    // Check notifications on component mount
    checkBirthdayNotifications();

    // Set up periodic checks (every hour in production, you might want daily)
    const interval = setInterval(checkBirthdayNotifications, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, toast]);

  // This component doesn't render anything visible
  return null;
};