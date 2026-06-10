-- 历史深度研报标为 Research Pro；公开样例由 daily-content 每日首篇继续产出
update posts
   set is_premium = 1
 where kind = 'analysis'
   and is_premium = 0;
