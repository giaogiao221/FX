MATCH ()-[r:STANDARD_RULE]->()
RETURN count(r) AS relation_count,
       count(CASE WHEN coalesce(r.review_status, 'accepted') = 'accepted' THEN 1 END) AS accepted_relation_count,
       count(CASE WHEN coalesce(startNode(r).review_status, 'accepted') = 'accepted' AND coalesce(endNode(r).review_status, 'accepted') = 'accepted' THEN 1 END) AS accepted_endpoint_count;

MATCH (n:KGNode)
WHERE n.entity_type IN ['Standard','Clause','ManagementRequirement','InspectionRequirement','Evidence']
  AND coalesce(n.review_status, 'accepted') <> 'accepted'
RETURN count(n) AS nonaccepted_standard_nodes;
