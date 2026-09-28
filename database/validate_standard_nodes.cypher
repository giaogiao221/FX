MATCH (n:KGNode)
WHERE n.entity_type IN ['Standard','Clause','ManagementRequirement','InspectionRequirement','Evidence']
RETURN n.entity_type AS entity_type, count(n) AS count
ORDER BY entity_type;
